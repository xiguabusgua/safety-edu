#!/usr/bin/env bash
# scripts/server-init.sh
# 服务器一次性初始化脚本 —— 在服务器上跑一次就行
# 用法: ssh root@你的IP 'bash -s' < scripts/server-init.sh
#
# 跑完后去 GitHub 填 3 个 Secrets，然后 git push main 自动部署
set -euo pipefail

R='\033[0;31m'; G='\033[0;32m'; Y='\033[1;33m'; N='\033[0m'
ok()  { echo -e "${G}[✓]${N} $*"; }
warn(){ echo -e "${Y}[!]${N} $*"; }
err() { echo -e "${R}[✗]${N} $*" >&2; }

APP_DIR=/www/wwwroot/safety-edu

echo "== 1/6 安装系统依赖 =="
apt update -qq
apt install -y -qq curl git python3 python3-pip mysql-server nodejs 2>/dev/null || {
  # 如果 nodejs 不够新，用 nodesource
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y -qq nodejs
}
ok "系统依赖安装完成"

echo "== 2/6 安装 pnpm + pm2 =="
npm i -g pnpm@9 pm2 2>/dev/null
ok "pnpm + pm2 安装完成"

echo "== 3/6 创建目录结构 =="
mkdir -p "$APP_DIR"/{releases,shared/logs}
ok "目录创建完成 ($APP_DIR)"

echo "== 4/6 配置 MySQL =="
# 如果 lens_light 数据库不存在则创建
mysql -u root -e "
  CREATE DATABASE IF NOT EXISTS lens_light CHARACTER SET utf8mb4;
  CREATE USER IF NOT EXISTS 'lens_light'@'localhost' IDENTIFIED BY 'lens_light_pass';
  GRANT ALL ON lens_light.* TO 'lens_light'@'localhost';
  FLUSH PRIVILEGES;
" 2>/dev/null && ok "MySQL 配置完成" || warn "MySQL 配置跳过（请手动建库：CREATE DATABASE lens_light;）"

echo "== 5/6 生成 .env 文件 =="
if [ ! -f "$APP_DIR/shared/.env" ]; then
  cat > "$APP_DIR/shared/.env" << 'ENVEOF'
DATABASE_URL="mysql://lens_light:lens_light_pass@127.0.0.1:3306/lens_light"
PORT=3002
NODE_ENV=production
ACCOUNT_ENC_KEY="0000000000000000000000000000000000000000000000000000000000000000"
COOKIE_SECRET="CHANGE_ME_COOKIE_SECRET_32CHARS_LONG!!"
JWT_SECRET="CHANGE_ME_JWT_SECRET_32CHARS_LONG!!!!!!"
CORS_ORIGIN="https://safety.52akuya.asia"
PUBLIC_BASE_URL="https://safety.52akuya.asia"
RUNNER_CONCURRENCY=2
PAY_MODE=mock
ENVEOF
  ok ".env 已生成（⚠️ 请修改密钥和 CORS_ORIGIN）"
  warn "执行: nano $APP_DIR/shared/.env  # 改 ACCOUNT_ENC_KEY / COOKIE_SECRET / JWT_SECRET / CORS_ORIGIN"
else
  ok ".env 已存在，跳过"
fi

echo "== 6/6 配置 SSH 公钥 =="
if [ ! -f ~/.ssh/id_ed25519 ]; then
  ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N '' -q
  cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys
  ok "SSH 密钥已生成"
else
  ok "SSH 密钥已存在"
fi

echo ""
echo "============================================================"
echo "✅ 服务器初始化完成"
echo ""
echo "下一步："
echo "  1. 编辑 .env: nano $APP_DIR/shared/.env  # 改密钥和域名"
echo "  2. 在你的电脑上执行: cat ~/.ssh/id_rsa.pub"
echo "  3. 把输出的公钥粘贴到服务器: nano ~/.ssh/authorized_keys"
echo "     (或者用 ssh-copy-id root@你的服务器IP 更简单)"
echo "  4. 去 GitHub 仓库 → Settings → Secrets → Actions 填:"
echo "     - DEPLOY_HOST: 你的服务器IP"
echo "     - DEPLOY_USER: root"
echo "     - DEPLOY_KEY:  你电脑的 ~/.ssh/id_rsa (全部内容)"
echo "  5. 推代码到 main: git push"
echo "  6. 首次部署后，ssh 到服务器执行:"
echo "     cd $APP_DIR/current/apps/api && npx prisma migrate dev --name init"
echo "============================================================"
