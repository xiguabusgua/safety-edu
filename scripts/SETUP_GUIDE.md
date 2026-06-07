# GitHub Actions 自动部署 —— 设置指南

## 第一步：服务器一次性准备（ssh 进去执行一次）

```bash
# 如果你是 root，不需要 sudo
# 如果不是 root，每条前面加 sudo

# 1. 装 Node 20 + pnpm + PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install nodejs git -y
npm i -g pnpm@9 pm2

# 2. 装 Python + 依赖
apt install python3 python3-pip -y

# 3. 装 MySQL（如果你还没有 MySQL）
apt install mysql-server -y

# 4. 创建项目目录
mkdir -p /www/wwwroot/safety-edu/{releases,shared/logs}

# 5. 上传 .env 配置
#    用 vim 或 nano 创建 shared/.env，内容参考项目根目录的 .env.example
#    ⚠️ 必须填好：DATABASE_URL / JWT_SECRET / COOKIE_SECRET / ACCOUNT_ENC_KEY
nano /www/wwwroot/safety-edu/shared/.env

# 6. 创建 MySQL 数据库和用户（如果还没有）
mysql -u root -p -e "
CREATE DATABASE IF NOT EXISTS lens_light CHARACTER SET utf8mb4;
CREATE USER IF NOT EXISTS 'lens_light'@'localhost' IDENTIFIED BY '你的密码';
GRANT ALL ON lens_light.* TO 'lens_light'@'localhost';
FLUSH PRIVILEGES;
"

# 7. 还要把服务器 SSH 的公钥加到 authorized_keys 里（GitHub Actions 需要）
#    先敲 ssh-keygen -t ed25519，然后：
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys
```

## 第二步：GitHub 仓库添加 Secrets

打开浏览器进你的 GitHub 仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**，添加 3 个：

| Secret | 值 |
|--------|-----|
| `DEPLOY_HOST` | 服务器 IP （如 `154.9.25.199`） |
| `DEPLOY_USER` | SSH 用户名 （如 `root`） |
| `DEPLOY_KEY` | 你本地电脑的私钥 `cat ~/.ssh/id_rsa` 全部内容（注意：是**你的电脑**的私钥，不是服务器的） |

> 💡 `DEPLOY_KEY` 必须是**你电脑上能登录服务器的那个私钥**。如果你是用密码登录的，先跑 `ssh-keygen -t ed25519 && ssh-copy-id root@你的服务器IP` 配好密钥登录。

## 第三步：第一次部署手动跑

把代码推到 GitHub 的 `main` 分支后，Actions 自动触发。第一次部署后还需要手动跑一次数据库建表：

```bash
ssh root@你的服务器IP
cd /www/wwwroot/safety-edu/current/apps/api
npx prisma migrate dev --name init
pm2 restart safety-api
```

## 以后每次部署

```bash
git push main
# GitHub Actions 自动完成：检查类型 → 构建 → 上传 → PM2 重启 → 健康检查
```

---

**总结：你只需要做 3 件事：**
1. 服务器跑一次"一次性准备"的 7 条命令（复制粘贴）
2. GitHub 网页填 3 个 Secrets（每行一个值）
3. 第一次部署后手动跑一次 `prisma migrate dev --name init`
