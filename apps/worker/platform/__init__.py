"""Platform 抽象层

每个平台一个子模块，实现 :class:`Platform` 协议。
新增平台 = 在此加一行 + 在 :file:`platform/<name>/` 下加实现。
"""
from platform.base import Platform, PlatformError, Course, StudyResult, ExamResult
from platform.weban.client import WeBanPlatform
from platform.jiangsu.platform import JiangsuPlatform


_REGISTRY: dict[str, type[Platform]] = {
    "weban": WeBanPlatform,
    "jiangsu": JiangsuPlatform,
}


def get_platform(name: str) -> Platform:
    cls = _REGISTRY.get(name)
    if not cls:
        raise KeyError(name)
    return cls()


__all__ = ["Platform", "PlatformError", "get_platform"]
