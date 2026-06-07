"""WeBan 平台入口

Usage:
    from platform.weban.client import WeBanPlatform
    plat = WeBanPlatform()
    plat.login({"school": "南京大学", "userId": "2211000", "password": "xxx"})
    courses = plat.list_courses()
"""
from .client import WeBanPlatform

__all__ = ["WeBanPlatform"]
