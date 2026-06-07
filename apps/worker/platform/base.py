"""Platform 抽象基类与公共数据结构。"""
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


class PlatformError(Exception):
    """平台操作错误。fatal=True 时任务立即终止。"""

    def __init__(self, code: str, message: str, fatal: bool = False):
        super().__init__(message)
        self.code = code
        self.message = message
        self.fatal = fatal


@dataclass
class Course:
    id: str
    title: str
    category: str | None = None
    progress: float = 0.0  # 0~1
    finished: bool = False


@dataclass
class StudyResult:
    ok: bool
    msg: str = ""
    progress: float = 1.0


@dataclass
class ExamResult:
    ok: bool
    score: float = 0.0
    cert_url: str | None = None
    msg: str = ""


class Platform(ABC):
    """平台抽象基类。"""

    name: str = "base"
    display_name: str = "未命名平台"
    # Node 端预加载的题库答案: {questionText → answer},通过 payload 传入
    question_map: dict[str, str] = {}

    @abstractmethod
    def login(self, credentials: dict[str, Any]) -> None:
        """登录，失败抛 PlatformError。"""

    @abstractmethod
    def list_courses(self) -> list[Course]:
        """拉取所有课程。"""

    @abstractmethod
    def study_course(self, course_id: str) -> StudyResult:
        """学习单门课。"""

    @abstractmethod
    def take_exam(self, course_id: str) -> ExamResult:
        """参加单门课的考试。"""
