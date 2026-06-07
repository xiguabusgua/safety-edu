#!/usr/bin/env python3
"""
导入 WeBan 题库 (answer/answer.json) 到 SQLite 数据库 (Question 表)

数据格式：
{
  "<题干>": {
    "optionList": [{"content": "...", "isCorrect": 1|2}, ...],
    "type": 1|2|3
  }
}

用法：
  python3 scripts/import_weiban_questions.py <answer.json 路径> [db.sqlite 路径]

默认 db 路径：apps/api/prisma/dev.db
"""
from __future__ import annotations
import json
import sys
import os
import re
import sqlite3
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_DB = SCRIPT_DIR.parent / "apps" / "api" / "prisma" / "dev.db"


def load_questions(json_path: str) -> list[dict]:
    """解析 WeBan answer.json → 标准 Question 格式"""
    with open(json_path, "r", encoding="utf-8") as f:
        raw: dict[str, Any] = json.load(f)

    questions = []
    for q_text, payload in raw.items():
        option_list = payload.get("optionList", [])
        raw_type = payload.get("type", 1)

        if not option_list:
            continue

        options = [opt["content"] for opt in option_list]
        correct_indices = [
            i for i, opt in enumerate(option_list) if opt.get("isCorrect") == 1
        ]

        # 题型推断
        if len(option_list) == 2 and raw_type == 3:
            q_type = "judge"
            ans = "对" if (correct_indices and correct_indices[0] == 0) else "错"
        elif len(correct_indices) >= 2:
            q_type = "multiple"
            ans = "".join(chr(ord("A") + i) for i in correct_indices)
        else:
            q_type = "single"
            ans = chr(ord("A") + correct_indices[0]) if correct_indices else "?"

        # 清洗题干
        clean_text = re.sub(r"\s+", " ", q_text.replace("\xa0", " ")).strip()

        questions.append({
            "platform": "weban",
            "category": None,
            "questionText": clean_text,
            "options": json.dumps(options, ensure_ascii=False),
            "answer": ans,
            "questionType": q_type,
            "hitCount": 0,
        })

    return questions


def main():
    if len(sys.argv) < 2:
        print("用法: python3 import_weiban_questions.py <answer.json> [db.sqlite]")
        sys.exit(1)

    json_path = sys.argv[1]
    db_path = sys.argv[2] if len(sys.argv) > 2 else str(DEFAULT_DB)

    if not os.path.exists(json_path):
        print(f"❌ 找不到: {json_path}")
        sys.exit(1)

    if not os.path.exists(db_path):
        print(f"❌ 找不到数据库: {db_path}")
        print(f"   请先跑: cd apps/api && npx prisma db push")
        sys.exit(1)

    print(f"📂 读取: {json_path}")
    questions = load_questions(json_path)
    print(f"✅ 解析: {len(questions)} 题")

    type_count = {}
    for q in questions:
        type_count[q["questionType"]] = type_count.get(q["questionType"], 0) + 1
    print(f"   分布: {type_count}")

    print(f"💾 写入: {db_path}")
    con = sqlite3.connect(db_path)
    cur = con.cursor()

    # 验证表存在
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='Question'")
    if not cur.fetchone():
        print(f"❌ 数据库里没有 Question 表")
        print(f"   请先跑: cd apps/api && npx prisma db push")
        sys.exit(1)

    # 批量插入（跳过重复：靠已有数据查重）
    cur.execute("SELECT questionText FROM Question WHERE platform = 'weban'")
    existing = {row[0] for row in cur.fetchall()}
    print(f"   已有: {len(existing)} 条")

    BATCH = 500
    inserted = 0
    skipped = 0
    rows_to_insert = [q for q in questions if q["questionText"] not in existing]
    print(f"   待新增: {len(rows_to_insert)} 条（去重后）")

    for i in range(0, len(rows_to_insert), BATCH):
        batch = rows_to_insert[i : i + BATCH]
        for q in batch:
            try:
                cur.execute(
                    """
                    INSERT INTO Question
                    (platform, category, questionText, options, answer, questionType, hitCount, createdAt, updatedAt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                    """,
                    (q["platform"], q["category"], q["questionText"], q["options"], q["answer"], q["questionType"], q["hitCount"]),
                )
                inserted += 1
            except sqlite3.IntegrityError:
                skipped += 1
        con.commit()
        print(f"   进度: {min(i + BATCH, len(rows_to_insert))}/{len(rows_to_insert)}")

    cur.execute("SELECT COUNT(*) FROM Question")
    total = cur.fetchone()[0]
    con.close()

    print(f"\n✨ 完成: 新增 {inserted}，跳过 {skipped}")
    print(f"📊 题库总数: {total}")


if __name__ == "__main__":
    main()
