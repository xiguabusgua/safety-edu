#!/bin/sh
# entrypoint-runner.sh — safety-runner Docker container entrypoint
set -e

echo "[entrypoint-runner] Starting safety-runner..."
echo "[entrypoint-runner] Worker dir: ${WORKER_DIR:-/app/apps/worker}"
echo "[entrypoint-runner] Concurrency: ${RUNNER_CONCURRENCY:-2}"

export PYTHONUNBUFFERED=1
export WORKER_DIR="${WORKER_DIR:-/app/apps/worker}"

exec node dist/workers/taskRunner.js
