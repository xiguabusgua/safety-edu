# =============================================================================
# safety-edu Runner Dockerfile
#
# Runs the taskRunner (Node.js) which polls for paid tasks and spawns
# Python worker subprocesses. Needs both Node.js and Python 3.
# =============================================================================

# ---- Builder Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@9.12.0 --registry=https://registry.npmmirror.com && \
    apk add --no-cache python3 make g++

# 1. Cached dependency install
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/
COPY packages/shared-types/package.json ./packages/shared-types/

RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# 2. Source code (only api — the runner lives inside apps/api/src/workers/)
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# 3. Generate Prisma client
RUN cd apps/api && npx prisma generate

# 4. Build api (tsc) — produces dist/workers/taskRunner.js
RUN pnpm --filter api build

# ---- Production Stage ----
FROM node:20-bookworm-slim

WORKDIR /app

# Install Python 3 + pip globally
RUN apt-get update -qq && \
    apt-get install -y -qq --no-install-recommends \
        python3 \
        python3-pip \
        openssl \
    && rm -rf /var/lib/apt/lists/*

# Install Python worker dependencies (global, so `python3` finds them)
COPY apps/worker/requirements.txt /tmp/worker-requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -i https://pypi.tuna.tsinghua.edu.cn/simple -r /tmp/worker-requirements.txt && \
    rm /tmp/worker-requirements.txt

# Copy workspace + node_modules
# NOTE: Both root node_modules (the .pnpm package store) and per-package
# node_modules (symlinks into .pnpm) are needed for pnpm resolution.
# Single copies would break require() at runtime.
COPY --from=builder /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/

# Copy Python worker scripts
COPY apps/worker/ ./apps/worker/

WORKDIR /app/apps/api

ENV WORKER_DIR=/app/apps/worker
ENV PYTHONUNBUFFERED=1

COPY apps/worker/entrypoint.sh /app/apps/api/entrypoint-runner.sh
RUN chmod +x /app/apps/api/entrypoint-runner.sh

CMD ["/app/apps/api/entrypoint-runner.sh"]
