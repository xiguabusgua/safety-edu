# 架构

## 总体

```
┌──────────────────────────────────────────────────────────┐
│                    React (Vite) Frontend                 │
│   Home → Submit → Pay → Progress(SSE) → Result           │
└──────────────────────────┬───────────────────────────────┘
                           │ HTTPS / SSE
┌──────────────────────────▼───────────────────────────────┐
│               Nginx (宝塔 154.9.25.199)                  │
│   safety.52akuya.asia → 127.0.0.1:3001 (api)             │
│                    → 127.0.0.1:3000 (web)                │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│             Express API (PM2 cluster × 2)                │
│   - /api/tasks   创建/查询任务                            │
│   - /api/pay     创建支付订单 + 回调                       │
│   - /api/stream/:taskId   SSE 实时进度                   │
│   - /api/admin/* 后台（账号密码）                          │
└──────────────────────────┬───────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
       ┌──────────┐              ┌──────────┐
       │  MySQL   │              │  Redis   │ (可选后期)
       │  tasks   │              │  queue   │
       │  settings│              └──────────┘
       │  admins  │
       └──────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│       TaskRunner (PM2 fork, 单进程轮询 pending)          │
│   - 轮询 tasks WHERE status='pending' AND paid_at IS NOT NULL│
│   - fork python runner.py --payload '{...}'             │
│   - 解析 stdout JSON → 写回 tasks + push SSE             │
└──────────────────────────┬───────────────────────────────┘
                           │ 子进程
┌──────────────────────────▼───────────────────────────────┐
│                Python Worker (runner.py)                 │
│   ┌─────────────┐  ┌─────────────┐                       │
│   │  Platform   │  │  Platform   │  ← 抽象基类            │
│   │  WeBan      │  │  Jiangsu    │                       │
│   │ (从 hangone │  │ (从 Scwizard│                       │
│   │  /WeBan 移植)│  │  /skip 移植)│                       │
│   └─────────────┘  └─────────────┘                       │
│   - ddddocr 验证码识别                                   │
│   - 题库加载（来自 MySQL questions 表）                   │
└──────────────────────────────────────────────────────────┘
```

## 数据流

1. **创建任务**：
   - 前端提交 `{ platform, school, userId, password, ... }`
   - API 加密账号 → 写 `tasks` 表（status=`awaiting_payment`）→ 返回 `task_id` + 支付 URL
   - 前端展示支付宝二维码

2. **支付回调**：
   - 支付宝 POST 回调 `/api/pay/notify` → 验签 → 更新 `tasks.paid_at` + `status=pending`
   - 同时通过 SSE 通知前端"已支付，开始跑"

3. **执行任务**：
   - Runner 轮询 `status=pending AND paid_at IS NOT NULL`
   - 取出 → fork `python runner.py` → 子进程 stdout 输出结构化 JSON 日志
   - Runner 解析每行 → 写 `task_events` 表 + 通过 EventBus 推 SSE
   - 任务结束 → 写 `status=done/failed` + 存最终结果

4. **实时进度**：
   - 前端 `EventSource('/api/stream/:taskId')` 连上后，server 把它加入订阅
   - Runner 推事件时通过 `events` (Node EventEmitter) → SSE handler 推给所有订阅者
   - Runner / API 进程分离 → 用 `Redis pub/sub` 或 MySQL 轮询兜底（前期用后者）

## 关键设计

### Platform 抽象（Python 端）

```python
# apps/worker/platform/base.py
class Platform(ABC):
    name: str
    @abstractmethod
    def login(self, credentials: dict) -> None: ...
    @abstractmethod
    def list_courses(self) -> list[Course]: ...
    @abstractmethod
    def study_course(self, course_id: str) -> StudyResult: ...
    @abstractmethod
    def take_exam(self, course_id: str) -> ExamResult: ...

# apps/worker/platform/weban/platform.py
class WeBanPlatform(Platform):
    name = "weban"
    def __init__(self): self.client = WeBanClient()
    def login(self, c): self.client.login(c["userId"], c["password"], c["school"])
    ...

# apps/worker/platform/jiangsu/platform.py
class JiangsuPlatform(Platform):
    name = "jiangsu"
    def __init__(self): self.client = JiangsuClient()
    def login(self, c): self.client.login(c["userId"])
    ...
```

### runner.py 协议

输入（stdin or argv）：
```json
{
  "task_id": "tsk_xxx",
  "platform": "weban",
  "credentials": { "userId": "...", "password": "..." },
  "options": { "study": true, "exam": true, "max_exam_rounds": 3 }
}
```

输出（stdout，每行一个 JSON 对象）：
```json
{"event": "log",      "level": "info", "msg": "正在学习第 3/12 课"}
{"event": "progress", "phase": "study", "current": 3, "total": 12}
{"event": "done",     "result": { "study": {...}, "exam": {...}, "cert_url": "..." }}
{"event": "error",    "code": "captcha_blocked", "msg": "需要手动验证码"}
```

### SSE 事件协议

```
GET /api/stream/:taskId
Accept: text/event-stream

data: {"event":"log","msg":"..."}
data: {"event":"progress","current":3,"total":12}
data: {"event":"phase","phase":"exam"}
data: {"event":"done","result":{...}}
```

## 安全

- 账号密码 AES-256-GCM 加密存 DB（key 在 `.env`）
- 任务完成后 24h 内清除明文账号
- 管理员密码 bcrypt + JWT
- Nginx HTTPS（Let's Encrypt / 宝塔 SSL）
- HMAC 验签支付宝回调

## 风控与容错

- 平台接口失败重试 3 次（指数退避）
- 验证码识别失败降级为"半自动"：提示用户去浏览器手动过一次
- 任务超时（默认 30 分钟）自动标记 failed
- 单 IP 24h 最多 5 单（防滥用）
