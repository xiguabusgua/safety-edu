#!/usr/bin/env python3
"""
E2E 测试：模拟 runner.py 跑一次任务

用法：
  python3 scripts/e2e_test.py [weban|jiangsu]
  默认 weban

不连真平台：用一个 mock Platform，跑 5 门 mock 课 + mock 考试，
验证 stdout JSON Lines 协议 + Task 状态流转。
"""
from __future__ import annotations
import sys
import json
import time
import os
import re
from pathlib import Path
from typing import Any

# 切到 worker 目录
SCRIPT_DIR = Path(__file__).resolve().parent
WORKER_DIR = SCRIPT_DIR.parent / "apps" / "worker"
os.chdir(WORKER_DIR)
sys.path.insert(0, str(WORKER_DIR))

# Mock ddddocr import（如果没装）
try:
    import ddddocr  # noqa
except ImportError:
    sys.modules.setdefault("ddddocr", type(sys)("ddddocr"))

from platform.base import Platform, Course, StudyResult, ExamResult  # noqa
from platform.weban.client import WeBanPlatform  # noqa
from platform.jiangsu.platform import JiangsuPlatform  # noqa


class MockPlatform(Platform):
    """不连真平台，模拟课程 + 学习 + 考试全流程"""

    name = "mock"
    display_name = "Mock"

    def login(self, credentials: dict) -> None:
        print({"event": "log", "level": "info", "msg": f"[mock] 登录成功 user={credentials.get('userId')}"}, flush=True)
        time.sleep(0.3)

    def list_courses(self) -> list[Course]:
        return [
            Course(id=f"mock-course-{i+1}", title=f"Mock 课程 {i+1}")
            for i in range(5)
        ]

    def study_course(self, course_id: str) -> StudyResult:
        time.sleep(0.5)  # 模拟学习时长
        return StudyResult(ok=True, msg=f"已学完 {course_id}")

    def take_exam(self, course_id: str) -> ExamResult:
        time.sleep(0.5)
        return ExamResult(ok=True, score=95.0, msg=f"考试 {course_id} 95 分")


def emit(event: dict) -> None:
    sys.stdout.write(json.dumps(event, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def run(payload: dict) -> None:
    platform_name = payload.get("platform", "mock")
    creds = payload.get("credentials", {})
    options = payload.get("options", {})

    # 选 platform
    if platform_name == "mock":
        plat = MockPlatform()
    else:
        try:
            from platform import get_platform
            plat = get_platform(platform_name)
        except Exception as e:
            emit({"event": "error", "code": "platform_init", "msg": str(e)})
            return

    # ============== 登录 ==============
    emit({"event": "phase", "phase": "login"})
    emit({"event": "log", "level": "info", "msg": f"正在登录 {plat.display_name}..."})
    try:
        plat.login(creds)
    except Exception as e:
        emit({"event": "error", "code": getattr(e, "code", "login_failed"), "msg": str(e)})
        return
    emit({"event": "log", "level": "info", "msg": "登录成功"})

    # ============== 拉课程 ==============
    try:
        courses = plat.list_courses()
    except Exception as e:
        emit({"event": "error", "code": "list_failed", "msg": str(e)})
        return
    emit({"event": "log", "level": "info", "msg": f"发现 {len(courses)} 门课程"})

    # ============== 学习 ==============
    result_study = {"passed": 0, "failed": 0, "details": []}
    if options.get("study", True):
        emit({"event": "phase", "phase": "study"})
        total = len(courses)
        for idx, course in enumerate(courses, 1):
            emit({"event": "progress", "phase": "study", "current": idx, "total": total})
            emit({"event": "log", "level": "info", "msg": f"学习中: {course.title}"})
            try:
                r = plat.study_course(course.id)
                if r.ok:
                    result_study["passed"] += 1
                else:
                    result_study["failed"] += 1
                result_study["details"].append({"course_id": course.id, "title": course.title, "ok": r.ok, "msg": r.msg})
            except Exception as e:
                result_study["failed"] += 1
                emit({"event": "log", "level": "error", "msg": f"学习失败: {e}"})

    # ============== 考试 ==============
    result_exam = {"passed": 0, "failed": 0, "details": []}
    if options.get("exam", True):
        emit({"event": "phase", "phase": "exam"})
        total = len(courses)
        for idx, course in enumerate(courses, 1):
            emit({"event": "progress", "phase": "exam", "current": idx, "total": total})
            emit({"event": "log", "level": "info", "msg": f"考试中: {course.title}"})
            try:
                r = plat.take_exam(course.id)
                if r.ok:
                    result_exam["passed"] += 1
                else:
                    result_exam["failed"] += 1
                result_exam["details"].append({"course_id": course.id, "title": course.title, "score": r.score, "ok": r.ok})
            except Exception as e:
                result_exam["failed"] += 1
                emit({"event": "log", "level": "error", "msg": f"考试失败: {e}"})

    # ============== 完成 ==============
    emit({
        "event": "done",
        "result": {
            "study": result_study,
            "exam": result_exam,
            "cert_url": None,
            "elapsed_sec": 0,
        },
    })


def main():
    platform = sys.argv[1] if len(sys.argv) > 1 else "mock"
    payload = {
        "task_id": "tsk_test_e2e",
        "platform": platform,
        "credentials": {"school": "南京大学", "userId": "test", "password": "test"},
        "options": {"study": True, "exam": True},
    }
    run(payload)
    return 0


if __name__ == "__main__":
    sys.exit(main())
