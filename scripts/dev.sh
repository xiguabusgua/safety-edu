#!/usr/bin/env bash
# scripts/dev.sh — 本地一键起整个开发栈
# 启动：api (port 3002) + taskRunner + web (port 5173)
# 关闭：Ctrl+C，自动 cleanup
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$ROOT/apps/api"
WEB_DIR="$ROOT/apps/web"

# 加载 .env
if [ -f "$API_DIR/.env" ]; then
  export $(cat "$API_DIR/.env" | grep -v '^#' | xargs)
fi

API_PORT="${PORT:-3002}"
WEB_PORT="${WEB_PORT:-5173}"

cleanup() {
  echo ""
  echo "🛑 关停..."
  pkill -f "tsx.*src/index.ts" 2>/dev/null
  pkill -f "tsx.*src/workers" 2>/dev/null
  pkill -f "vite" 2>/dev/null
  exit 0
}
trap cleanup INT TERM

echo "=== 1/3 启动 API (port $API_PORT) ==="
(cd "$API_DIR" && nohup npx tsx src/index.ts > /tmp/safety-api.log 2>&1 &)
sleep 3
if ! curl -s --max-time 2 "http://127.0.0.1:$API_PORT/api/health" > /dev/null; then
  echo "❌ API 启动失败，查看 /tmp/safety-api.log"
  cat /tmp/safety-api.log
  exit 1
fi
echo "✅ API 健康"

echo ""
echo "=== 2/3 启动 TaskRunner ==="
(cd "$API_DIR" && nohup npx tsx src/workers/taskRunner.ts > /tmp/safety-runner.log 2>&1 &)
sleep 2
echo "✅ Runner 启动"

echo ""
echo "=== 3/3 启动 Web (port $WEB_PORT) ==="
(cd "$WEB_DIR" && API_PROXY="http://127.0.0.1:$API_PORT" nohup npx vite --host 0.0.0.0 --port "$WEB_PORT" > /tmp/safety-web.log 2>&1 &)
sleep 4
echo "✅ Web 启动"

echo ""
echo "================================"
echo "✅ 全部就绪"
echo ""
echo "  站点:   http://localhost:$WEB_PORT"
echo "  API:    http://127.0.0.1:$API_PORT/api/health"
echo "  Admin:  http://localhost:$WEB_PORT/admin/login"
echo "  Runner: 进程已起，日志 /tmp/safety-runner.log"
echo ""
echo "  日志:"
echo "    tail -f /tmp/safety-api.log"
echo "    tail -f /tmp/safety-runner.log"
echo "    tail -f /tmp/safety-web.log"
echo ""
echo "按 Ctrl+C 关闭全部进程"
echo "================================"
echo ""

# 阻塞
wait
