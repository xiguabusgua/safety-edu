"""
WeBan 平台 - 轻量版 API 封装

只实现 Platform 抽象必要的方法。
验证码手动模式：跑出来在终端显示图片 URL，让你看完输入。

参考：[hangone/WeBan](https://github.com/hangone/WeBan)
原版 ~1300 行，本精简版 ~250 行，保留核心。
"""
from __future__ import annotations
import hashlib
import json
import time
from base64 import b64encode, urlsafe_b64decode, urlsafe_b64encode
from random import randint
from typing import Any
from uuid import uuid4

import requests
import pyaes
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


def _pkcs7_pad(data: bytes, block_size: int = 16) -> bytes:
    pad_len = block_size - (len(data) % block_size)
    return data + bytes([pad_len] * pad_len)


class WeBanError(Exception):
    """平台业务错误"""
    def __init__(self, code: str, msg: str, fatal: bool = False):
        super().__init__(msg)
        self.code = code
        self.msg = msg
        self.fatal = fatal


class _Session:
    """统一 requests session：自动重试 + 浏览器头"""

    DEFAULT_HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json, text/plain, */*",
    }

    def __init__(self):
        self._s = requests.Session()
        retry = Retry(total=5, backoff_factor=1, status_forcelist=[429, 500, 502, 503, 504])
        self._s.mount("https://", HTTPAdapter(max_retries=retry))
        self._s.headers.update(self.DEFAULT_HEADERS)

    def request(self, method, url, **kwargs):
        return self._s.request(method, url, timeout=15, **kwargs)

    @property
    def headers(self):
        return self._s.headers


class WeBanAPI:
    BASE = "https://weiban.mycourse.cn"
    ANSWER_URL = (
        "https://gh-proxy.com/https://github.com/hangone/WeBan/"
        "raw/refs/heads/main/answer/answer.json"
    )

    def __init__(self, account: str, password: str, tenant_code: str | None = None):
        self.account = account
        self.password = password
        self.tenant_code = tenant_code
        self.session = _Session()
        self.user: dict[str, Any] = {"userId": "", "token": ""}
        self.session.headers["X-Token"] = ""

    # ========== 加密 / 时间戳 ==========

    @staticmethod
    def _ts(int_len: int = 10, frac_len: int = 3) -> str:
        t = str(time.time_ns())
        return f"{t[:int_len]}.{t[int_len:int_len+frac_len]}" if frac_len else t[:int_len]

    @staticmethod
    def _encrypt(data: str) -> str:
        """登录请求用：固定密钥 AES-ECB"""
        key = urlsafe_b64decode("d2JzNTEyAAAAAAAAAAAAAA==")
        padded = _pkcs7_pad(data.encode())
        aes = pyaes.AESModeOfOperationECB(key)
        encrypted = b"".join(aes.encrypt(padded[i:i+16]) for i in range(0, len(padded), 16))
        return urlsafe_b64encode(encrypted).decode()

    @staticmethod
    def _encrypt_apinext(data: dict) -> str:
        """apinext 用：AES-CBC 双重 base64"""
        key = b"KkGv9d8E5jYb2xHwL3ZqRpXoNt6MmSge"
        iv = key[:16]
        padded = _pkcs7_pad(json.dumps(data, separators=(",", ":")).encode())
        aes = pyaes.AESModeOfOperationCBC(key, iv=iv)
        encrypted = b"".join(aes.encrypt(padded[i:i+16]) for i in range(0, len(padded), 16))
        return b64encode(b64encode(encrypted)).decode()

    # ========== 通用请求 ==========

    def _post(self, endpoint: str, data: dict | None = None) -> dict:
        url = f"{self.BASE}{endpoint}"
        body = dict(data or {})
        body.setdefault("tenantCode", self.tenant_code)
        if self.user.get("userId"):
            body.setdefault("userId", self.user["userId"])
        r = self.session.request("POST", url, params={"timestamp": self._ts()}, data=body)
        return r.json() if r.status_code == 200 else {}

    def _mercury(self, params: dict) -> dict:
        """mercuryprovider 接口：拼固定参数 + SHA1 签名"""
        standard = {
            "appKey": "00000001", "format": "json", "v": "1.0",
            "timestamp": self._ts(), "clientId": "pharos",
        }
        merged = {**standard, **params}
        secret = "75uet0kwvnc90xo"
        sign_str = secret
        for k in sorted(merged.keys()):
            sign_str += k + str(merged[k])
        sign_str += secret
        merged["sign"] = hashlib.sha1(sign_str.encode()).hexdigest().upper()
        r = self.session.request(
            "POST",
            "https://resource.mycourse.cn/mercuryprovider/router",
            data=merged,
        )
        return r.json() if r.status_code == 200 else {}

    # ========== 登录 ==========

    def get_tenant_list(self) -> dict:
        """获取学校代码列表"""
        r = self.session.request(
            "POST", f"{self.BASE}/pharos/login/getTenantListWithLetter.do",
            params={"timestamp": self._ts()},
        )
        return r.json() if r.status_code == 200 else {}

    def find_tenant_code(self, school_name: str) -> str | None:
        """根据学校名找 tenantCode"""
        resp = self.get_tenant_list()
        if resp.get("code") != "0":
            return None
        for item in resp.get("data", []):
            for entry in item.get("list", []):
                if entry.get("name", "").strip() == school_name.strip():
                    return entry["code"]
                if school_name in entry.get("name", ""):
                    return entry["code"]  # 模糊匹配
        return None

    def get_captcha_image(self) -> tuple[bytes, str]:
        """获取验证码图片 + 时间戳"""
        ts = int(self._ts(frac_len=0))
        r = self.session.request(
            "GET", f"{self.BASE}/pharos/login/randLetterImage.do",
            params={"time": ts},
        )
        return r.content, str(ts)

    def login(self, verify_code: str, verify_time: str) -> dict:
        """登录。AES-ECB 加密请求体"""
        payload = {
            "keyNumber": self.account,
            "password": self.password,
            "tenantCode": self.tenant_code,
            "time": int(verify_time),
            "verifyCode": verify_code,
        }
        encrypted = self._encrypt(json.dumps(payload, separators=(",", ":")))
        r = self.session.request(
            "POST", f"{self.BASE}/pharos/login/login.do",
            params={"timestamp": self._ts()}, data={"data": encrypted},
        )
        result = r.json() if r.status_code == 200 else {}
        if result.get("data", {}).get("token"):
            self.user = result["data"]
            self.session.headers["X-Token"] = self.user["token"]
            self.password = None
        return result

    # ========== 项目 / 课程 ==========

    def list_my_project(self) -> dict:
        return self._post("/pharos/index/listMyProject.do", {"ended": 2})

    def show_progress(self, user_project_id: str) -> dict:
        return self._post("/pharos/project/showProgress.do", {"userProjectId": user_project_id})

    def list_category(self, user_project_id: str, choose_type: int = 3) -> dict:
        return self._post(
            "/pharos/usercourse/listCategory.do",
            {"userProjectId": user_project_id, "chooseType": choose_type},
        )

    def list_course(self, user_project_id: str, category_code: str, choose_type: int = 3) -> dict:
        return self._post(
            "/pharos/usercourse/listCourse.do",
            {"userProjectId": user_project_id, "chooseType": choose_type, "categoryCode": category_code},
        )

    def study(self, course_id: str, user_project_id: str) -> dict:
        return self._post(
            "/pharos/usercourse/study.do",
            {"courseId": course_id, "userProjectId": user_project_id},
        )

    def get_course_url(self, course_id: str, user_project_id: str) -> dict:
        return self._post(
            "/pharos/usercourse/getCourseUrl.do",
            {"courseId": course_id, "userProjectId": user_project_id},
        )

    def finish_by_token(self, user_course_id: str, token: str | None = None) -> dict:
        """完课。token 来自验证码，无验证码模式直接用 user_course_id"""
        url = f"{self.BASE}/pharos/usercourse/v2/{token or user_course_id}.do"
        data = {"userCourseId": user_course_id, "tenantCode": self.tenant_code}
        for attempt in range(6):
            ts = int(self._ts(13, 0))
            cb = f"jQuery3410{randint(10**15, 10**16-1)}_{ts}"
            r = self.session.request(
                "GET", url, params={**data, "callback": cb, "_": ts + 1},
            )
            try:
                result = r.json()
            except Exception:
                text = r.text
                s, e = text.find("("), text.rfind(")")
                if s != -1 and e != -1:
                    try:
                        result = json.loads(text[s+1:e])
                    except Exception:
                        result = {"raw": text}
                else:
                    result = {"raw": text}
            if result.get("detailCode") == "10018" and attempt < 5:
                time.sleep((3, 6, 10, 15, 20)[attempt])
                continue
            return result
        return {}

    # ========== 题目（学习/考试通用） ==========

    def list_question(self, course_id: str) -> dict:
        return self._mercury({
            "service": "mercury.microlecture.listQuestion", "id": course_id,
        })

    def save_question(self, course_id: str, question_id: str, answers: str, source: str = "WEIBAN") -> dict:
        return self._mercury({
            "service": "mercury.microlecture.saveQuestion",
            "courseId": course_id, "questionId": question_id,
            "answers": answers, "userId": self.user["userId"],
            "tenantCode": self.tenant_code, "source": source,
        })

    def save_exam_question(self, course_id: str, question_id: str, answers: str, source: str = "WEIBAN") -> dict:
        return self._mercury({
            "service": "mercury.microlecture.saveExamQuestion",
            "courseId": course_id, "questionId": question_id,
            "answers": answers, "userId": self.user["userId"],
            "tenantCode": self.tenant_code, "source": source,
        })

    # ========== 考试 ==========

    def exam_list_plan(self, user_project_id: str) -> dict:
        return self._post("/pharos/exam/listPlan.do", {"userProjectId": user_project_id})

    def exam_prepare_paper(self, user_exam_plan_id: str) -> dict:
        return self._post("/pharos/exam/preparePaper.do", {"userExamPlanId": user_exam_plan_id})

    def exam_start_paper(self, user_exam_plan_id: str) -> dict:
        return self._post("/pharos/exam/startPaper.do", {"userExamPlanId": user_exam_plan_id})

    def exam_record_question(
        self, user_exam_plan_id: str, question_id: str,
        use_time: int, answer_ids: list[str] | None, exam_plan_id: str,
    ) -> dict:
        data = {
            "userExamPlanId": user_exam_plan_id,
            "questionId": question_id,
            "useTime": use_time,
            "examPlanId": exam_plan_id,
        }
        if answer_ids:
            data["answerIds"] = ",".join(answer_ids)
        return self._post("/pharos/exam/recordQuestion.do", data)

    def exam_submit_paper(self, user_exam_plan_id: str) -> dict:
        return self._post("/pharos/exam/submitPaper.do", {"userExamPlanId": user_exam_plan_id})

    # ========== apinext（部分课程需要） ==========

    def apinext(
        self, user_course_id: str, course_id: str, user_project_id: str,
        step: int = 0, finish: int = 2, nonstr: str = "", unique_no: str | None = None,
    ) -> dict:
        data = {
            "userCourseId": user_course_id,
            "uniqueNo": unique_no or str(uuid4()),
            "userId": self.user["userId"],
            "courseId": course_id,
            "userProjectId": user_project_id,
            "finished": finish,
            "step": step,
            "nonstr": nonstr,
            "tenantCode": self.tenant_code,
        }
        encrypted = self._encrypt_apinext(data)
        r = self.session.request(
            "POST", f"{self.BASE}/jupiterapi/api/statusercourse/v1/next",
            json={"data": encrypted},
        )
        return r.json() if r.status_code == 200 else {}
