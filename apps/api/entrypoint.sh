#!/bin/sh
# entrypoint.sh — safety-api Docker container entrypoint
#
# 1. Apply pending Prisma migrations
# 2. Start the Express server
set -e

echo "[entrypoint] Applying database migrations..."
npx prisma migrate deploy
echo "[entrypoint] Migrations applied."

echo "[entrypoint] Starting safety-api on port ${PORT:-3002}..."
exec node dist/index.js
