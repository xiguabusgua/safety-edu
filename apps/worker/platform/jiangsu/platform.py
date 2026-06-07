"""Jiangsu (江苏校园安全通) 平台实现

代码来源：[Scwizard/jiangsu-safety-platform-skip](https://github.com/Scwizard/jiangsu-safety-platform-skip)

仅支持 userid 模式：用户从微信扫码登录后 URL 里拿 userid 数字。
账号密码模式需要微信 openId，本平台未对外提供，暂不接入。
"""
from __future__ import annotations
import os
import sqlite3
from typing import Any

import requests

from platform.base import Platform, Course, StudyResult, ExamResult, PlatformError


class JiangsuPlatform(Platform):
    name = "jiangsu"
    display_name = "江苏校园安全通"

    BASE = "http://wap.xiaoyuananquantong.com/guns-vip-main/wap"
    COLLEGE_ID = "1224316234189443073"  # 江苏省统一

    # 课程配置（从 jiangsu-skip/main.py 移植）
    COURSES = [
        {"articleId": "1672768716061863938", "title": "题库学习", "question": "1677233633049554945-1", "quesType": "3"},
        {"articleId": "1493130725405294593", "title": "入学安全", "question": "1677226064641896450-A", "quesType": "1"},
        {"articleId": "1493144962773041153", "title": "国家安全", "question": "~1677237820399398914-A~1677237820399398914-B~1677237820399398914-C", "quesType": "2"},
        {"articleId": "1493144438782836737", "title": "财物安全", "question": "1677246774982586370-0", "quesType": "3"},
        {"articleId": "1493144798591205378", "title": "心理健康", "question": "1677248976384012289-A", "quesType": "1"},
        {"articleId": "1493144639081824257", "title": "消防安全", "question": "1677231441840287746-1", "quesType": "3"},
        {"articleId": "1493144727023796226", "title": "人身安全", "question": "1677234520794968065-1", "quesType": "3"},
        {"articleId": "1672797851245158401", "title": "交通安全", "question": "1677236377873395714-C", "quesType": "1"},
        {"articleId": "1493144873958653953", "title": "应急救护", "question": "~1810585965882793986-A~1810585965882793986-B~1810585965882793986-C~1810585965882793986-D", "quesType": "2"},
        {"articleId": "1810496679200198657", "title": "防灾减灾", "question": "1810587849070764033-A", "quesType": "1"},
    ]

    def __init__(self) -> None:
        self.user_id: str | None = None

    def login(self, credentials: dict[str, Any]) -> None:
        user_id = credentials.get("userId")
        if not user_id or not str(user_id).isdigit():
            raise PlatformError("missing_creds", "userid 必须是纯数字", fatal=True)
        self.user_id = str(user_id)

    def list_courses(self) -> list[Course]:
        """调 /compulsory/list 拉课程完成度"""
        r = requests.post(
            f"{self.BASE}/compulsory/list",
            data={"userId": self.user_id, "collegeId": self.COLLEGE_ID},
            timeout=15,
        )
        data = r.json()
        if data.get("code") != 200:
            raise PlatformError("list_failed", f"拉课程失败: {data.get('message')}", fatal=True)

        return [
            Course(
                id=item.get("articleId") or item.get("id", ""),
                title=item.get("name", ""),
                finished=item.get("isFinsh", False),
            )
            for item in data.get("data", [])
        ]

    def study_course(self, course_id: str) -> StudyResult:
        """学习：调 /unitTest"""
        cfg = next((c for c in self.COURSES if c["articleId"] == course_id), None)
        if not cfg:
            return StudyResult(ok=True, msg="未知课程，跳过")

        payload = {
            "articleId": cfg["articleId"],
            "title": cfg["title"],
            "userId": self.user_id,
            "ah": "",
            "question": cfg["question"],
            "quesType": cfg["quesType"],
        }
        try:
            r = requests.post(f"{self.BASE}/unitTest", data=payload, timeout=15)
            return StudyResult(ok=True, msg=f"已提交 {cfg['title']}")
        except Exception as e:
            return StudyResult(ok=False, msg=f"提交失败: {e}")

    def take_exam(self, course_id: str) -> ExamResult:
        """考试：合并 tiku 答案后提交"""
        # 1. 创建考试
        r = requests.post(
            f"{self.BASE}/test/create",
            data={"examId": "1948924196784492546", "userId": self.user_id},
            timeout=15,
        )
        data = r.json()
        if data.get("code") != 200 or "logId" not in data.get("data", {}):
            return ExamResult(ok=False, score=0, msg=f"创建考试失败: {data.get('message')}")
        log_id = data["data"]["logId"]

        # 2. 获取考题
        r = requests.get(
            f"{self.BASE}/test/list",
            params={"logId": log_id, "page": 1, "limit": 200, "ah": "", "userId": self.user_id},
            timeout=15,
        )
        exam_data = r.json()
        questions = exam_data["data"]["data"][:50]

        # 3. 查答案
        answers = self._lookup_answers([q["questionId"] for q in questions])

        # 4. 提交答案（逐题提交）
        submitted = 0
        for q in questions:
            qid = q["questionId"]
            ans = answers.get(qid, "")
            if not ans:
                continue
            try:
                requests.post(
                    f"{self.BASE}/test/submit",
                    data={
                        "logId": log_id,
                        "questionId": qid,
                        "answer": ans,
                        "userId": self.user_id,
                    },
                    timeout=10,
                )
                submitted += 1
            except Exception:
                pass

        # 5. 交卷
        try:
            requests.post(
                f"{self.BASE}/test/finish",
                data={"logId": log_id, "userId": self.user_id},
                timeout=10,
            )
        except Exception:
            pass

        if submitted > 0:
            score = round(submitted / len(questions) * 100, 1) if questions else 100.0
            return ExamResult(ok=True, score=score, msg=f"已提交 {submitted}/{len(questions)} 题答案")
        return ExamResult(ok=False, score=0, msg="未找到答案，无法完成考试（请先导入 tiku 数据）")

    def _lookup_answers(self, question_ids: list[str]) -> dict[str, str]:
        """从多个数据源查答案（优先级：tiku SQLite > question_map）

        - tiku 表来自 jiangsu-skip 项目的独立 SQLite 文件,需手动导入
        - question_map 由 Node 端从 Prisma Question 表预加载
        """
        result: dict[str, str] = {}

        # 1) tiku SQLite 文件(外部数据)
        try:
            db_paths = [
                os.environ.get("JIANGSU_TIKU_DB"),
                os.path.join(os.getcwd(), "apps/api/prisma/dev.db"),
                os.path.join(os.path.dirname(__file__), "../../../api/prisma/dev.db"),
            ]
            db_path = next((p for p in db_paths if p and os.path.exists(p)), None)
            if db_path:
                con = sqlite3.connect(db_path)
                cur = con.cursor()
                cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='tiku'")
                if cur.fetchone():
                    placeholders = ",".join("?" * len(question_ids))
                    cur.execute(
                        f"SELECT questionId, answer FROM tiku WHERE questionId IN ({placeholders})",
                        question_ids,
                    )
                    for row in cur.fetchall():
                        result[row[0]] = row[1]
                con.close()
        except Exception:
            pass

        # 2) question_map(Node 预加载, key=questionText, value=answer)
        #    注意 tiku 是 questionId 索引,Question 表是 questionText 索引,
        #    两者 key 格式不同,这里仅作为兜底。
        if self.question_map:
            # 尝试用 questionId 直接查找(少量 tiku style 数据可能已导入 Question 表)
            for qid in question_ids:
                if qid in self.question_map:
                    result[qid] = self.question_map[qid]

        return result
