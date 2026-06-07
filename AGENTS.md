# AGENTS.md · safety-edu 项目

> 摄影师大 K 的"安全教育一站式"项目 — 帮大学生自动完成"安全微伴 / 江苏安全通"两个平台的安全教育课程和考试。
> 这是 **per-project memory**,只对 `/Users/amnesiac/Desktop/安全教育与安全微伴/` 仓库成立。跨项目可复用的工程模式见 `~/.mavis/agents/coder/memory/MEMORY.md`(agent 级)。

## 1. Monorepo 布局

```
安全教育与安全微伴/
├── apps/
│   ├── web/         React 18 + Vite 5 + Tailwind 3 + zustand 4 + sonner + react-query 5
│   ├── api/         Express 后端(端口 3002)
│   └── worker/      Node 任务调度 + Python 子进程(平台爬虫)
├── packages/
│   └── shared-types/  前后端 TS 类型共享(file: 协议引用)
├── scripts/         部署 / 工具脚本
├── docs/            设计文档
├── ecosystem.config.cjs   PM2 配置(service 名 lens-api)
└── pnpm-workspace.yaml
```

## 2. 端口约定

| 用途 | 端口 | 备注 |
|------|------|------|
| web dev | 5173 | vite 启动,占用频繁被其他项目抢 |
| web preview | 4173 | |
| api | 3002 | Express |
| prod 部署 | 154.9.25.199 | root,`/www/wwwroot/lens-and-light`,PM2 lens-api |

**起 dev 之前先 lsof** — Mac 上摄影网站等其他项目常占 5173/5174:
```bash
lsof -nP -i:5173 -i:5174
# 看到其他 vite 占着 → pkill -9 -f "vite.*5173" 清掉
```

## 3. apps/web 关键组件位置

- `src/components/QrCodeCanvas.tsx` — 本地二维码(替代 api.qrserver.com,1.5.4)
- `src/components/Reveal.tsx` — IntersectionObserver 滚动入场
- `src/components/ThemeToggle.tsx` — 跟 useThemeStore 联动
- `src/components/SiteHeader.tsx` — 浮动 pill 导航(不是 edge-to-edge sticky)
- `src/stores/theme.ts` — zustand 主题 store
- `src/config/platforms.ts` — 平台配置表(weban/jiangsu,含 name/price/loginUrl)
- `src/lib/` 和 `src/hooks/` — **空目录,预留**
- `index.css` — `.bezel-shell + .bezel-core + .card` 三层架构 + 各种 component utility

## 4. 设计系统(已统一)

- 字体:Geist Variable(无衬线)、Geist Mono、Newsreader Variable(衬线大标题)
- 主题:warm cream editorial,**CSS 变量已统一为 RGB 三段数字格式**(`--ink-secondary: 47 52 55;` 而不是 `#2F3437`)
- 调色板走 `rgb(var(--xxx) / <alpha-value>)` 以支持 Tailwind alpha 修饰符
- `boxShadow` 走 `--shadow-card` / `--shadow-card-hover` CSS 变量,dark 模式不同 alpha
- 暗色模式 class:`<html class="dark">` + zustand `useThemeStore` 联动

## 5. 部署

```bash
# 本地构建
cd apps/web && npm run build  # 输出 dist/

# 推到服务器(预构建,服务器无 Node)
tar czf - -C apps/web/dist . | ssh root@154.9.25.199 "cd /www/wwwroot/lens-and-light && tar xzf -"

# PM2 重启
ssh root@154.9.25.199 "pm2 restart lens-api"
```

服务器 `push-to-server.sh` 的 git remote 用 `id_rsa` 硬编码,实际部署走 scp 推 dist。

## 6. 数据库

- MySQL,库名 `lens_light`,用户 `lens_light`
- ORM:Prisma,`apps/api/prisma/schema.prisma`
- 本机无 MySQL 时,用 `prisma migrate diff --from-empty --to-schema-datamodel` 离线生成 SQL
- 索引约定:复合索引 `[A, B]` 走最左前缀,统计查询用单列索引

## 7. 测试

- 已有 `vitest@4.1.8 + jsdom`,装在 `apps/web`
- `npm test` 跑全部(目前 4 个 theme store 单元测试)
- 新增测试写到 `src/**/*.test.{ts,tsx}`

## 8. 已知坑 / 防御点

- `sonner` Toaster 在 `main.tsx` 是根级,跟 ThemeToggle 平级,**无法 prop drilling** → 用 zustand 订阅
- `qrcode` 包装在 `apps/web` 不是 monorepo 根(单 app 够用)
- CSS 变量改 RGB 三段格式时,**原本带 alpha 的变量**(`rgba(0,0,0,0.05)` 这种)要拆成 `RGB` + 调用处 `/[0.05]`,grep 全文防漏
- 看到 dev server 报 404 但 vite log 显示已 ready — 八成是其他项目占着端口,curl 实际访问的不是自己的进程
- `reveal` 包装三层 div 结构(`bezel-shell + bezel-core + card`)时**不要多加 `</div>`**,用 `grep Reveal` 配对

## 9. 主要页面路由

| 路由 | 页面 | 备注 |
|------|------|------|
| `/` | Home | editorial landing |
| `/submit/:platform` | Submit | weban / jiangsu,平台走 `config/platforms.ts` |
| `/task/:taskId` | Progress | SSE 实时进度,支付二维码 |
| `/my-tasks` | MyTasks | 历史任务列表 |
| `/legal` | Legal | 隐私条款 |
| `/admin/*` | AdminDashboard | 后台 stats + 任务流水 |
| `/admin/questions` | AdminQuestions | 题库管理 |

## 10. apps/api 后端关键约定(2026-06-07 修复后)

### PM2 进程模式
- `safety-api`:**单进程 fork**(`instances: 1, exec_mode: 'fork'`)— SSE EventBus 是内存版,cluster 模式下不通
- `safety-runner`:**单进程 fork**(`instances: 1, exec_mode: 'fork'`),靠 `RUNNER_CONCURRENCY` 控制并发(2-3 个 Python 子进程)
- 后期切 Redis pub/sub 时,`safety-api` 改回 `instances >= 2, exec_mode: 'cluster'` 即可

### 任务调度防御(`apps/api/src/workers/taskRunner.ts`)
- `tick()` 拿任务后用 `prisma.task.updateMany({ where: { id, status: 'pending' }, data: { status: 'running' }})` 做**乐观锁**,`count === 0` 放弃
- 超时监控(30s 一次)用 `findMany({ where: { id: { in: [...activeJobs.keys()] }, status: 'running' }})` 批量查,**禁止 N+1 findUnique**

### 支付安全(`apps/api/src/routes/pay.ts` + `lib/wechatPay.ts` + `lib/wechatPayIps.ts`)
- `isMockMode` 判定:**严格 XOR** — MCHID 和 APPID 要么都配要么都不配,不一致强制走 mock,显式 `PAY_MODE=mock` 也走 mock
- `notify-wechat` 入口第一行就做 IP 白名单(`isWechatNotifyIp`),先于验签防伪造通知消耗 CPU/DB
- `mock-callback` 只在 dev 启用,加 `isLocalRequest(req)` 检查 127/10/192.168/172.16-31
- 微信支付私钥加载:`getPrivateKey()` 必须 `.replace(/\\n/g, '\n')`,处理 .env 多行 PEM 被压成字面量的情况
- 微信回调 IP 段(11 个 CIDR)在 `lib/wechatPayIps.ts`,**官方更新时同步改这个文件**,顶部有官方链接

### 加密 / Cookie(`apps/api/src/lib/crypto.ts` + `middleware/deviceId.ts`)
- `ACCOUNT_ENC_KEY` 严格接受 64-char hex 或 44-char base64,**不接 sha256 派生**,启动时 throw
- 生产 cookie 命名 `__Host-safety_uid`,本地 dev 用普通 `safety_uid` 避开 http://localhost 拒收
  - `__Host-` 前缀浏览器强制 Secure + Path=/ + 不带 Domain
  - 部署时务必 `NODE_ENV=production`,否则会种普通 cookie 失去防子域保护

### tsc 验证
- 跑 type-check 时需要假 env:`DATABASE_URL='mysql://fake:fake@localhost:3306/fake' JWT_SECRET='<30+chars>' COOKIE_SECRET='<30+chars>' ACCOUNT_ENC_KEY=$(printf 'a%.0s' {1..64}) npx tsc --noEmit`

## 11. 已知坑 / 防御点(API 层)

- 任何 dev-only 端点都要加 `isLocalRequest` IP 校验,不光靠 `NODE_ENV=production` 区分(dev 端口经常被反代/隧道误暴露到公网)
- `account.eventBus` 是单进程内存版,**PM2 多 worker 之间不通**,所以 API 必须是 fork × 1
- 状态机迁移(pending→running, awaiting_payment→paid)必须用 `updateMany + count` 乐观锁,不能 `prisma.x.update` 直接覆盖
- 微信支付私钥的 `.env` 注入要做 `\n` 还原,否则 `crypto.createSign().sign()` 抛 "no start line" 错
- 改 `prisma.x.update` 这种「按字段名写」的地方,先 `Read` 对应 model 的 schema 确认每个字段语义,字段名相似(schoolName vs city)是高危信号

