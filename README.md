# Safety Edu · 安全教育一站式平台

合并 [Scwizard/jiangsu-safety-platform-skip](https://github.com/Scwizard/jiangsu-safety-platform-skip) 与 [hangone/WeBan](https://github.com/hangone/WeBan)，把"本地 CLI 脚本"升级为"在线服务"。

> ⚠️ **非营利学习交流项目**。仅供学习与个人效率使用，严禁商业用途。

## 用户旅程

```
打开 safety.52akuya.asia
  → 选平台（WeBan / 江苏安全通）
  → 填学校 + 账号 + 密码
  → 微信扫码付款
  → SSE 实时进度
  → 完课结果 & 证书
```

## 技术栈

| 层 | 选型 |
|---|------|
| 前端 | React 18 + Vite + Tailwind + zustand + react-query |
| 后端 | Express + Prisma + MySQL |
| Worker | Python 3（验证码 OCR + 平台爬虫） |
| 部署 | PM2 + Nginx，Express 一端口 serve 全站 |

## 目录

```
apps/
  web/           # React 前端
  api/           # Express 后端（也 serve 前端 dist）
  worker/        # Python 自动化（WeBan / Jiangsu 爬虫）
packages/
  shared-types/  # 前后端共享 TS 类型
scripts/         # 部署 / 本地开发 / 题库导入
```

---

## 本地开发

```bash
# 1. 装依赖
pnpm install
cd apps/worker && pip install -r requirements.txt

# 2. 起全部 (api + runner + web)
#    先配 apps/api/.env（参考 .env.example）
bash scripts/dev.sh
#    → web: http://localhost:5173
#    → api: http://localhost:3002/api/health
```

---

## 部署 —— 自动部署（推荐）

见 [scripts/SETUP_GUIDE.md](scripts/SETUP_GUIDE.md) —— 3 步配好 GitHub Actions 自动部署，以后 `git push main` 即自动上线。

### 方式 B：本地一键命令（备选）

推代码到 `main` 分支，自动构建 → 推送 → 重启。

**一次性设置：**

1. **服务器预装**（5 分钟）：
```bash
# Node 20 + pnpm
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt install nodejs -y
npm i -g pnpm@9 pm2

# Python 3
apt install python3 python3-pip -y
cd /www/wwwroot/safety-edu/apps/worker && pip install -r requirements.txt

# MySQL (或用你已有的)
apt install mysql-server -y

# 初始化目录
mkdir -p /www/wwwroot/safety-edu/{releases,shared/logs}
cp .env.example /www/wwwroot/safety-edu/shared/.env
# 编辑 .env 填真实值：
vim /www/wwwroot/safety-edu/shared/.env
```

2. **GitHub Secrets**（仓库 Settings → Secrets → Actions）：
   - `DEPLOY_HOST`：服务器 IP
   - `DEPLOY_USER`：SSH 用户（如 `root`）
   - `DEPLOY_KEY`：SSH 私钥内容（`cat ~/.ssh/id_rsa`）

然后正常推代码，每次 `git push` 自动部署。

---

### 方式 B：本地一键命令

```bash
SERVER=root@你的服务器IP bash scripts/build-and-push.sh
```

自动完成 `build → package → scp → pm2 reload → health check`。

前提：服务器已完成方式 A 的「一次性设置」+ SSH key 免密登录。

---

### 方式 C：服务器端手动

```bash
ssh root@你的服务器

cd /www/wwwroot/safety-edu
git pull
pnpm install --frozen-lockfile
pnpm build:all
cd apps/api && npx prisma migrate deploy
pm2 startOrReload ecosystem.config.cjs --env production
curl http://127.0.0.1:3002/api/health  # 验证
```

---

## PM2 进程

```bash
pm2 status
# ┌─────┬────────────────┬──────┬──────┬──────┐
# │ id  │ name           │ mode │ ↺    │ uptime│
# ├─────┼────────────────┼──────┼──────┼──────┤
# │ 0   │ safety-api     │ fork │ 0    │ 24h  │  ← Express + 前端静态文件
# │ 1   │ safety-runner  │ fork │ 0    │ 24h  │  ← 任务调度 + Python 子进程
# └─────┴────────────────┴──────┴──────┴──────┘
```

只有 **2 个进程**：Express 同时 serve 前端 + API，不再需要独立的 web server 进程。

---

## Nginx 配置

Express 统一端口（默认 3002），nginx 只需反代全部流量：

```nginx
location / {
    proxy_pass http://127.0.0.1:3002;
    # ... 标准 proxy headers + SSE 长连接支持
}
```

完整模板见 `scripts/nginx-vhost.conf`。

---

## 许可证

基于 [hangone/WeBan](https://github.com/hangone/WeBan)（GPL-3.0）和 [Scwizard/jiangsu-safety-platform-skip](https://github.com/Scwizard/jiangsu-safety-platform-skip)（Apache-2.0），本项目以 **GPL-3.0** 发布。详见 [LICENSE](./LICENSE)。
