#!/usr/bin/env python3
"""
把刚拉到的 50 道考题 + Scwizard tiku 表 answer 匹配,导入 Question 表。

数据流:
  /wap/test/list → 50 道考题(questionId + 题干 + 选项)
  Scwizard database.db tiku 表 506 条(questionId + answer + quesType)
  匹配 → platform='jiangsu' 写入
"""
import sqlite3
import json
import re
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
DEV_DB = SCRIPT_DIR.parent / "apps" / "api" / "prisma" / "dev.db"
SCW_DB = Path("/tmp/safety-jiangsu.db")
EXAM_JSON = Path("/tmp/jiangsu_exam_questions.json")

# 章节 articleId → category 映射
COURSE_ID_TO_CATEGORY = {
    "1493122962222546945": "消防安全",  # courseId in sample
}
ARTICLE_ID_TO_CATEGORY = {
    "1672766170119335937": "题库学习",  # 题库学习
    "1493119396263034882": "入学安全",  # 入学安全
    "1493123219723452418": "国家安全",  # 国家安全
    "1493121831794704386": "财物安全",  # 财物安全
    "1493123097497239553": "心理健康",  # 心理健康
    "1493122962222546945": "消防安全",  # 消防安全
    "1493123010972942338": "人身安全",  # 人身安全
    "1492771270606909441": "交通安全",  # 交通安全(注意 Scwizard 用了 1672797851245158401,可能是 1672771270606909441)
    "1672771270606909441": "交通安全",
    "1493123153222762498": "应急救护",  # 应急救护
    "1810129380198879234": "防灾减灾",  # 防灾减灾
}

QUES_TYPE_MAP = {
    "1": "single",   # 单选
    "2": "multiple", # 多选
    "3": "judge",    # 判断
}

def scw_answer_to_normal(ans: str, qtype: str) -> str:
    """Scwizard tiku 的 answer '1'/'0' → '对'/'错' (judge); 字母不变 (single/multiple)"""
    if qtype == "3":
        return "对" if ans == "1" else "错"
    return ans  # A/B/C/D 或 AB/AC 等

def main():
    if not EXAM_JSON.exists():
        print(f"❌ 找不到 {EXAM_JSON}")
        return
    if not SCW_DB.exists():
        print(f"❌ 找不到 {SCW_DB}")
        return

    # 1. 加载 50 道考题
    with open(EXAM_JSON, "r", encoding="utf-8") as f:
        exam_list = json.load(f)
    print(f"加载考题 {len(exam_list)} 道")

    # 2. 加载 Scwizard tiku 表 506 条 answer,按 questionId 索引
    scw = sqlite3.connect(SCW_DB)
    scw_cur = scw.cursor()
    scw_dict = {}  # questionId → (answer, quesType)
    for row in scw_cur.execute("SELECT questionId, answer, quesType FROM tiku"):
        scw_dict[row[0]] = (row[1], row[2])
    scw.close()
    print(f"加载 Scwizard tiku {len(scw_dict)} 条")

    # 3. 解析每道考题
    parsed = []
    for item in exam_list:
        q = item.get("question", {})
        qid = item.get("questionId") or q.get("id")
        text = q.get("question", "").strip()
        if not text:
            continue
        # 选项 A-F(可能为空)
        options = []
        for letter in "ABCDEF":
            opt = q.get(f"option{letter}", "")
            if opt and opt.strip():
                options.append(f"{letter}. {opt.strip()}")
        # 题型
        qt = q.get("quesType", "1")
        qtype = QUES_TYPE_MAP.get(qt, "single")
        # answer 从 Scwizard 匹配
        if qid in scw_dict:
            scw_ans, scw_qt = scw_dict[qid]
            # 用 Scwizard 的 answer + 我们刚判断的 qtype(以 question 内容为准)
            answer = scw_answer_to_normal(scw_ans, qt)
        else:
            answer = ""  # 没匹配上,空着
        # category — 用 courseId(题目所属课程,跟 compulsory/list 的 articleId 对应)
        course_id = q.get("courseId", "")
        category = ARTICLE_ID_TO_CATEGORY.get(course_id, "公共安全")
        parsed.append({
            "questionId": qid,
            "questionText": text,
            "options": options,
            "questionType": qtype,
            "answer": answer,
            "category": category,
        })

    matched = sum(1 for p in parsed if p["answer"])
    print(f"解析 {len(parsed)} 题,Scwizard 匹配 {matched} 题")
    print(f"  answer 缺失 {len(parsed) - matched} 题(题库不在 506 条里)")

    # 4. 写入 dev.db
    c = sqlite3.connect(DEV_DB)
    cur = c.cursor()
    # 先清掉之前入错类目的(同题干)
    deleted_total = 0
    for p in parsed:
        cur.execute(
            "DELETE FROM Question WHERE platform='jiangsu' AND questionText=?",
            (p["questionText"],),
        )
        deleted_total += cur.rowcount
    if deleted_total:
        print(f"清掉之前入错类目的(同题干): {deleted_total} 条")
    c.commit()

    inserted = 0
    skipped = 0
    no_answer = 0
    for p in parsed:
        existing = cur.execute(
            "SELECT id FROM Question WHERE platform='jiangsu' AND questionText=?",
            (p["questionText"],),
        ).fetchone()
        if existing:
            skipped += 1
            continue
        if not p["answer"]:
            no_answer += 1
        cur.execute(
            """INSERT INTO Question
            (platform, category, questionText, options, answer, questionType, hitCount, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))""",
            (
                "jiangsu",
                p["category"],
                p["questionText"],
                json.dumps(p["options"], ensure_ascii=False),
                p["answer"],
                p["questionType"],
            ),
        )
        inserted += 1
    c.commit()
    print(f"已写入 {inserted} 题,跳过已存在 {skipped} 题,无 answer {no_answer} 题")

    # 统计
    total = cur.execute("SELECT COUNT(*) FROM Question WHERE platform='jiangsu'").fetchone()[0]
    by_cat = cur.execute(
        "SELECT COALESCE(category,'(无分类)'), COUNT(*) FROM Question WHERE platform='jiangsu' GROUP BY category ORDER BY 2 DESC"
    ).fetchall()
    by_type = cur.execute(
        "SELECT questionType, COUNT(*) FROM Question WHERE platform='jiangsu' GROUP BY questionType"
    ).fetchall()
    print(f"\n=== 江苏题库现状 ===")
    print(f"  总数: {total}")
    print(f"  按题型: {by_type}")
    print(f"  按分类:")
    for cat, n in by_cat:
        print(f"    {cat}: {n}")
    c.close()

if __name__ == "__main__":
    main()
