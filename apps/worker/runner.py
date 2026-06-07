#!/usr/bin/env python3
"""
runner.py — 任务执行入口

协议：
- argv 接收 --task-id <id>
- stdin 接收 JSON payload: { task_id, platform, credentials, options }
- stdout 输出 JSON Lines（每行一个事件）
- 退出码 0 = done, 非 0 = error

调用方（Node taskRunner）会解析 stdout 的每一行 JSON，
映射到 SSE 事件 + DB 写入。

事件类型：
  {"event": "log",      "level": "info", "msg": "..."}
  {"event": "phase",    "phase": "login" | "study" | "exam" | "done"}
  {"event": "progress", "phase": "study", "current": 3, "total": 12}
  {"event": "done",     "result": {...}}
  {"event": "error",    "code": "...", "msg": "..."}
"""
from __future__ import annotations
import argparse
import json
import sys
import traceback
from typing import Any

from platform import get_platform
from platform.base import Platform, PlatformError


def emit(event: dict) -> None:
    """写一行 JSON 到 stdout，立即 flush。"""
    sys.stdout.write(json.dumps(event, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def log(msg: str, level: str = "info") -> None:
    emit({"event": "log", "level": level, "msg": msg})


def _emit_done(result_study: dict, result_exam: dict, fatal_error: dict | None = None) -> None:
    """Emit a `done` event carrying the (possibly partial) result.

    即使任务因 fatal 错误中断,也必须先 emit done,把已积累的 result_study /
    result_exam 推到 Node 端并写入 DB.result 字段(后续 error 事件只翻 status
    不动 result,见 apps/api/src/workers/taskRunner.ts)。
    """
    payload: dict[str, Any] = {
        "event": "done",
        "result": {
            "study": result_study,
            "exam": result_exam,
            "cert_url": None,
            "elapsed_sec": 0,
        },
    }
    if fatal_error is not None:
        # 让前端 / 调试工具看到中断原因(不破坏协议,放在 result 里)
        payload["result"]["fatal_error"] = fatal_error
    emit(payload)


def run(payload: dict) -> None:
    platform_name = payload.get("platform")
    if not platform_name:
        emit({"event": "error", "code": "missing_platform", "msg": "platform 必填"})
        return

    try:
        plat: Platform = get_platform(platform_name)
    except KeyError:
        emit({"event": "error", "code": "unknown_platform", "msg": f"未知平台 {platform_name}"})
        return

    # 注入 Node 预加载的题库答案
    qmap: dict[str, str] = payload.get("question_map", {}) or {}
    plat.question_map = qmap

    creds = payload.get("credentials", {})
    options = payload.get("options", {})

    # ============== 登录 ==============
    emit({"event": "phase", "phase": "login"})
    log(f"正在登录 {plat.name}...")
    try:
        plat.login(creds)
    except PlatformError as e:
        emit({"event": "error", "code": e.code, "msg": e.message})
        return
    log("登录成功", "info")

    # ============== 拉课程 ==============
    try:
        courses = plat.list_courses()
    except PlatformError as e:
        emit({"event": "error", "code": e.code, "msg": e.message})
        return
    log(f"发现 {len(courses)} 门课程", "info")

    # ============== 学习 ==============
    # 提前初始化 result_exam,这样 fatal 路径上的 _emit_done 永远有值可用
    result_study = {"passed": 0, "failed": 0, "details": []}
    result_exam = {"passed": 0, "failed": 0, "details": []}
    if options.get("study", True):
        emit({"event": "phase", "phase": "study"})
        total = len(courses)
        for idx, course in enumerate(courses, 1):
            emit({"event": "progress", "phase": "study", "current": idx, "total": total})
            log(f"学习中: {course.title}")
            try:
                study_result = plat.study_course(course.id)
                if study_result.ok:
                    result_study["passed"] += 1
                else:
                    result_study["failed"] += 1
                result_study["details"].append({
                    "course_id": course.id,
                    "title": course.title,
                    "ok": study_result.ok,
                    "msg": study_result.msg,
                })
            except PlatformError as e:
                log(f"课程 {course.title} 学习失败: {e.message}", "error")
                result_study["failed"] += 1
                if e.fatal:
                    # 先 emit done 把部分 result_study 写进 DB.result
                    # 再 emit error 让 Node 把 status 翻到 failed
                    _emit_done(result_study, result_exam, fatal_error={"code": e.code, "msg": e.message})
                    emit({"event": "error", "code": e.code, "msg": e.message})
                    return

    # ============== 考试 ==============
    if options.get("exam", True):
        emit({"event": "phase", "phase": "exam"})
        total = len(courses)
        for idx, course in enumerate(courses, 1):
            emit({"event": "progress", "phase": "exam", "current": idx, "total": total})
            log(f"考试中: {course.title}")
            try:
                exam_result = plat.take_exam(course.id)
                if exam_result.ok:
                    result_exam["passed"] += 1
                else:
                    result_exam["failed"] += 1
                result_exam["details"].append({
                    "course_id": course.id,
                    "title": course.title,
                    "score": exam_result.score,
                    "ok": exam_result.ok,
                })
            except PlatformError as e:
                log(f"考试 {course.title} 失败: {e.message}", "error")
                result_exam["failed"] += 1

    # ============== 完成 ==============
    _emit_done(result_study, result_exam)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--task-id", required=True)
    args = parser.parse_args()

    try:
        payload = json.load(sys.stdin)
    except Exception as e:
        emit({"event": "error", "code": "bad_stdin", "msg": f"无法解析 stdin: {e}"})
        return 1

    try:
        run(payload)
        return 0
    except Exception as e:
        emit({"event": "error", "code": "unhandled", "msg": str(e)})
        traceback.print_exc(file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
