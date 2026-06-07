#!/usr/bin/env bash
# scripts/deploy.sh
# 服务器端部署脚本 (也用于 CI/CD 末尾的 pm2 reload / rollback)
#
# 子命令:
#   reload     pm2 reload (0-downtime)
#   rollback   回退到上一个 release
#   health     健康检查
#   status     查看状态
#
# 目录结构:
#   /www/wwwroot/safety-edu/
#     current         -> releases/<active>/
#     releases/<ts>/  每次部署一个目录
#     shared/
#       .env          跨版本共享 (不覆盖)
#       logs/         日志聚合

set -euo pipefail

APP_ROOT="${APP_ROOT:-/www/wwwroot/safety-edu}"
CURRENT_LINK="$APP_ROOT/current"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3002/api/health}"

R='\033[0;31m'; G='\033[0;32m'; N='\033[0m'
ok()  { echo -e "${G}[✓]${N} $*"; }
err() { echo -e "${R}[✗]${N} $*" >&2; }

cmd="${1:-help}"

reload() {
  cd "$APP_ROOT"
  [ -f shared/.env ] && cp shared/.env current/.env
  pm2 startOrReload ecosystem.config.cjs --env production
  ok "pm2 reload 完成"
}

rollback() {
  cd "$APP_ROOT/releases"
  versions=($(ls -1t))
  [ ${#versions[@]} -lt 2 ] && { err "只有 1 个 release, 无法回滚"; exit 1; }
  prev="${versions[1]}"
  ln -snf "$APP_ROOT/releases/$prev" "$CURRENT_LINK"
  ok "回滚到 $prev"
  reload
}

health() {
  for i in $(seq 1 10); do
    if curl -sf --max-time 2 "$HEALTH_URL" > /dev/null 2>&1; then
      ok "健康检查通过"
      curl -s "$HEALTH_URL" | python3 -c "import sys,json;d=json.load(sys.stdin);print('  status:',d.get('status'),'uptime:',d.get('uptimeSec'),'s')" 2>/dev/null || true
      return 0
    fi
    sleep 1
  done
  err "健康检查失败"
  return 1
}

status() {
  pm2 status
  echo
  echo "当前: $(readlink "$CURRENT_LINK" 2>/dev/null || echo 'none')"
  echo "保留: $(ls -1 "$APP_ROOT/releases" 2>/dev/null | wc -l | tr -d ' ') 个 release"
}

help() {
  echo "子命令: reload | rollback | health | status"
}

case "$cmd" in
  reload)   reload ;;
  rollback) rollback ;;
  health)   health ;;
  status)   status ;;
  *)        help ;;
esac
