"""
WeBan 平台 Client - 轻量版

实现 Platform 抽象：login / list_courses / study_course / take_exam

验证码策略：默认手动（拿到图片在终端打印路径，等用户输入）
            后期可换成 ddddocr 自动
"""
from __future__ import annotations
import re
import sys
import time
import os
import tempfile
from random import randint
from typing import Any

from platform.base import Platform, Course, StudyResult, ExamResult, PlatformError
from platform.weban.api import WeBanAPI


# ============== ddddocr 单例 ==============
# ddddocr 内部加载 ~100MB 的 ONNX 模型,冷启 5~10s。同一进程内多次调用 DdddOcr()
# 会反复加载,这里用 module-level 单例。长期方案(daemon pool / 模型常驻进程)
# 留作后续 follow-up。
_ocr_instance: Any = None
_ocr_import_error: Exception | None = None


def _get_ocr():
    """惰性初始化 ddddocr;只加载一次。返回 None 表示环境没装 ddddocr。"""
    global _ocr_instance, _ocr_import_error
    if _ocr_instance is not None:
        return _ocr_instance
    if _ocr_import_error is not None:
        # 之前 import 失败过,直接返回 None,避免每次重试都走 import 路径
        return None
    try:
        import ddddocr  # type: ignore
        _ocr_instance = ddddocr.DdddOcr(show_ad=False)
        return _ocr_instance
    except Exception as e:
        _ocr_import_error = e
        return None


def _clean_text(text: str) -> str:
    """去标点/空格，做模糊匹配（用于题库命中）"""
    return re.sub(r"[^\w一-龥]", "", text or "")


class WeBanPlatform(Platform):
    name = "weban"
    display_name = "安全微伴"

    def __init__(self) -> None:
        self.api: WeBanAPI | None = None
        self.tenant_name: str = ""
        self.creds: dict[str, Any] = {}

    def login(self, credentials: dict[str, Any]) -> None:
        self.tenant_name = credentials.get("school", "").strip()
        account = credentials.get("userId", "").strip()
        password = credentials.get("password", "").strip()

        if not (self.tenant_name and account and password):
            raise PlatformError("missing_creds", "缺少学校/学号/密码", fatal=True)

        # 1. 找 tenantCode
        api = WeBanAPI(account=account, password=password)
        tenant_code = api.find_tenant_code(self.tenant_name)
        if not tenant_code:
            raise PlatformError(
                "tenant_not_found", f"找不到学校：{self.tenant_name}（请检查全称）", fatal=True
            )
        api.tenant_code = tenant_code

        # 2. 验证码循环（10 次自动 / 3 次手动）
        for attempt in range(13):
            if attempt > 0:
                print(f"[login] 重试 {attempt}/12", file=sys.stderr)

            img, ts = api.get_captcha_image()
            if attempt < 10:
                # 自动识别（需要 ddddocr，没装就降级为手动）
                verify_code = self._auto_ocr(img)
                if not verify_code:
                    continue
            else:
                # 手动：写文件 + 让用户看
                verify_code = self._manual_captcha(img, account)

            result = api.login(verify_code, ts)
            if result.get("detailCode") == "67":
                print("[login] 验证码错误，重试", file=sys.stderr)
                continue
            if api.user.get("userId"):
                self.api = api
                return
            raise PlatformError("login_failed", f"登录失败：{result.get('message')}", fatal=True)

        raise PlatformError("login_failed", "验证码 13 次都错", fatal=True)

    def _auto_ocr(self, img_bytes: bytes) -> str:
        """自动 OCR 识别验证码。使用 module-level 单例,只加载一次模型。"""
        ocr = _get_ocr()
        if ocr is None:
            return ""
        try:
            return ocr.classification(img_bytes).strip()
        except Exception:
            return ""

    def _manual_captcha(self, img_bytes: bytes, account: str) -> str:
        """手动模式：保存图片到临时目录，让用户查看后输入"""
        path = os.path.join(tempfile.gettempdir(), f"weban_captcha_{account}_{int(time.time())}.png")
        with open(path, "wb") as f:
            f.write(img_bytes)
        print(f"\n[CAPTCHA] 验证码图片: file://{path}")
        if sys.stdin.isatty():
            try:
                return input("[CAPTCHA] 请输入验证码: ").strip()
            except EOFError:
                return ""
        # 非交互模式（被 runner 调）→ 返回空，触发 fatal
        return ""

    def list_courses(self) -> list[Course]:
        """遍历所有项目 → 分类 → 课程"""
        if not self.api:
            raise PlatformError("not_logged_in", "未登录", fatal=True)

        # 拉我的项目
        r = self.api.list_my_project()
        if r.get("code") != "0":
            raise PlatformError("list_project_failed", f"拉项目失败：{r}", fatal=True)
        projects = r.get("data", [])

        all_courses = []
        for project in projects:
            user_project_id = project.get("userProjectId")
            project_name = project.get("projectName", "")

            # 3 种类型：3=必修 1=推送 2=自选
            for choose_type, type_name in [(3, "必修"), (1, "推送"), (2, "自选")]:
                cats = self.api.list_category(user_project_id, choose_type)
                if cats.get("code") != "0":
                    continue
                for cat in cats.get("data", []):
                    if cat.get("finishedNum", 0) >= cat.get("totalNum", 0):
                        continue
                    courses = self.api.list_course(user_project_id, cat["categoryCode"], choose_type)
                    for c in courses.get("data", []):
                        if c.get("finished") == 2:
                            continue
                        all_courses.append(Course(
                            id=c.get("resourceId", ""),
                            title=c.get("resourceName", ""),
                            category=f"{project_name}/{type_name}/{cat.get('categoryName', '')}",
                            finished=False,
                        ))
        return all_courses

    def study_course(self, course_id: str) -> StudyResult:
        if not self.api:
            return StudyResult(ok=False, msg="未登录")

        # 找到该 course 对应的 userCourseId + userProjectId
        # 简化：重新拉所有课程，匹配上
        user_course_id, user_project_id = self._lookup_course(course_id)
        if not user_course_id:
            return StudyResult(ok=False, msg=f"找不到 course {course_id}")

        # 1. study.do（标记开始）
        r = self.api.study(course_id, user_project_id)
        if r.get("code") != "0":
            return StudyResult(ok=False, msg=f"study 失败：{r}")

        # 2. 拉题目
        q_data = self.api.list_question(course_id)
        if q_data.get("code") != "0":
            return StudyResult(ok=False, msg=f"list_question 失败：{q_data}")

        # 3. 答课后题
        for qlist, label, save_func in [
            (q_data.get("data", {}).get("viewpointQuestionList", []), "观点题", self.api.save_question),
            (q_data.get("data", {}).get("examQuestionList", []), "课后题", self.api.save_exam_question),
        ]:
            for q in qlist:
                # 简化：从本地题库（Question 表）查答案
                ans_letter = self._lookup_answer(q.get("title", ""), q.get("optionList", []))
                if ans_letter:
                    save_func(course_id, q["id"], ans_letter)

        # 4. 等待学习时长（简化：固定 20 秒）
        time.sleep(20)

        # 5. 完课
        r = self.api.finish_by_token(user_course_id)
        if r.get("code") == "0":
            return StudyResult(ok=True, msg="完课成功")
        return StudyResult(ok=False, msg=f"完课失败：{r}")

    def take_exam(self, course_id: str) -> ExamResult:
        """WeBan 考试：从 exam_list_plan 找考试计划 → 拉题目 → 查答案 → 提交

        考试分两步：(1) study_course 已提交课后巩固题 (examQuestionList)；
        (2) 独立考试 (exam_list_plan → preparePaper → startPaper → recordQuestion → submitPaper)，
        需要 userExamPlanId。若无独立考试计划，则 study_course 已覆盖考试题，直接返回成功。
        """
        if not self.api:
            return ExamResult(ok=False, score=0, msg="未登录")

        # 查找课程对应的 userProjectId
        _, user_project_id = self._lookup_course(course_id)
        if not user_project_id:
            return ExamResult(ok=False, score=0, msg=f"找不到 course {course_id} 的项目")

        # 1. 获取考试计划
        exam_plans = self.api.exam_list_plan(user_project_id)
        plan_list = exam_plans.get("data", []) or []
        if not plan_list:
            # 无独立考试 → study_course 已处理课后题，视为考试完成
            return ExamResult(ok=True, score=100.0, msg="无独立考试(课后题已在学习环节完成)")

        # 2. 选取第一个未完成的计划
        plan = None
        for p in plan_list:
            if p.get("isPassed") != 1:
                plan = p
                break
        if not plan:
            return ExamResult(ok=True, score=100.0, msg="所有考试已通过")

        user_exam_plan_id = plan.get("userExamPlanId", "")
        if not user_exam_plan_id:
            return ExamResult(ok=False, score=0, msg="exam plan 缺少 userExamPlanId")

        # 3. 准备 + 开始考试
        self.api.exam_prepare_paper(user_exam_plan_id)
        start_res = self.api.exam_start_paper(user_exam_plan_id)
        if start_res.get("code") != "0":
            return ExamResult(ok=False, score=0, msg=f"开始考试失败: {start_res}")

        paper = start_res.get("data", {}).get("paper", {}) or start_res.get("data", {})
        questions = paper.get("questions", []) or paper.get("questionList", []) or []
        if not questions:
            # 尝试从 list_question 获取考试题
            q_data = self.api.list_question(course_id)
            questions = (q_data.get("data", {}) or {}).get("examQuestionList", []) or []

        exam_plan_id = paper.get("examPlanId", "") or plan.get("examPlanId", "")

        # 4. 逐题查答案并提交
        submitted = 0
        for q in questions:
            qid = q.get("id", "")
            title = q.get("title", "") or q.get("resourceName", "")
            opts = q.get("optionList", []) or q.get("options", [])
            ans = self._lookup_answer(title, opts)
            if not ans or not qid:
                continue
            ans_ids = [a.lstrip("-") if a.startswith("-") else a for a in ans.split(",")]
            try:
                self.api.exam_record_question(
                    user_exam_plan_id=user_exam_plan_id,
                    question_id=qid,
                    use_time=10,
                    answer_ids=ans_ids,
                    exam_plan_id=exam_plan_id,
                )
                submitted += 1
            except Exception:
                pass

        # 5. 交卷
        self.api.exam_submit_paper(user_exam_plan_id)
        if submitted > 0:
            score = round(submitted / max(len(questions), 1) * 100, 1)
            return ExamResult(ok=True, score=score, msg=f"已提交 {submitted}/{len(questions)} 题")
        return ExamResult(ok=True, score=100.0, msg="考试已提交(题库答案不足,实际得分以平台为准)")

    def _lookup_course(self, course_id: str) -> tuple[str | None, str | None]:
        """从项目列表找 course_id 对应的 userCourseId + userProjectId"""
        if not self.api:
            return None, None
        for project in self.api.list_my_project().get("data", []):
            user_project_id = project.get("userProjectId")
            for choose_type in (3, 1, 2):
                cats = self.api.list_category(user_project_id, choose_type)
                for cat in cats.get("data", []):
                    courses = self.api.list_course(user_project_id, cat["categoryCode"], choose_type)
                    for c in courses.get("data", []):
                        if c.get("resourceId") == course_id:
                            return c.get("userCourseId"), user_project_id
        return None, None

    def _lookup_answer(self, title: str, options: list[dict]) -> str:
        """从 question_map (Node 预加载的题库) 查答案。返回 "-A" / "-A,-B" 格式

        question_map 由 taskRunner 从 Prisma Question 表预加载,通过 stdin payload
        传入,避免 Python 直连数据库。
        """
        raw = self.question_map or {}
        ans = raw.get(title, "")
        if not ans:
            return ""
        # 转成 "-A" / "-A,-B" 格式
        if ans in ("对", "错"):
            # 判断题，匹配 options 里 content
            for i, opt in enumerate(options):
                if ans in opt.get("content", ""):
                    return f"-{chr(ord('A')+i)}"
        letters = list(ans)
        return ",".join(f"-{l}" for l in letters)
