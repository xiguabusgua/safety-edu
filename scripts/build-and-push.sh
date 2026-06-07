#!/usr/bin/env bash
# scripts/build-and-push.sh
# 本机构建 + 推送到服务器 (CI/CD 之外的手动备选)
#
# 要求:
#   已配 SSH key: ssh-copy-id root@your-server
#   server 端已有 /www/wwwroot/safety-edu/{releases,shared/.env,scripts/deploy.sh}
#
# 用法:
#   bash scripts/build-and-push.sh
#   SERVER=root@154.9.25.199 bash scripts/build-and-push.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SERVER="${SERVER:-root@154.9.25.199}"
APP_DIR="${APP_DIR:-/www/wwwroot/safety-edu}"

R='\033[0;31m'; G='\033[0;32m'; B='\033[0;34m'; N='\033[0m'
log() { echo -e "${B}[$(date +%H:%M:%S)]${N} $*"; }
ok()  { echo -e "${G}[✓]${N} $*"; }
err() { echo -e "${R}[✗]${N} $*" >&2; }

log "1/4 build"
cd "$ROOT"
pnpm build:all

log "2/4 package"
TS=$(date +%s)
tar czf /tmp/deploy-$TS.tgz \
  --exclude='node_modules' --exclude='.env' --exclude='.git' --exclude='*.log' \
  apps/api/dist apps/web/dist apps/api/package.json apps/api/prisma apps/worker \
  packages ecosystem.config.cjs pnpm-workspace.yaml package.json pnpm-lock.yaml \
  scripts/deploy.sh
ok "tarball: $(du -h /tmp/deploy-$TS.tgz | cut -f1)"

log "3/4 push"
scp /tmp/deploy-$TS.tgz "$SERVER:/tmp/"
ok "已推送到服务器"

log "4/4 deploy"
ssh "$SERVER" "set -e; cd $APP_DIR
  mkdir -p releases/$TS
  tar xzf /tmp/deploy-$TS.tgz -C releases/$TS
  [ -f shared/.env ] && cp shared/.env releases/$TS/.env
  ln -snf releases/$TS current
  pm2 startOrReload ecosystem.config.cjs --env production
  echo ok"

# 健康检查
if ssh "$SERVER" "curl -sf --max-time 3 http://127.0.0.1:3002/api/health" > /dev/null 2>&1; then
  ok "部署完成 ✅"
else
  err "健康检查失败, 手动检查: ssh $SERVER pm2 logs safety-api"
fi

rm -f /tmp/deploy-$TS.tgz
ssh "$SERVER" "rm -f /tmp/deploy-$TS.tgz" || true
