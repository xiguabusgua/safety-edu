# =============================================================================
# safety-edu Runner Dockerfile
#
# Multi-stage: build on builder (x86) → copy dist to minimal runtime.
# =============================================================================

# ---- Builder Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

# Install deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/
COPY packages/shared-types/package.json ./packages/

RUN npm install --legacy-peer-deps

# Source
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build TypeScript (Node.js dist)
RUN npm run build

# ---- Production Stage ----
FROM node:20-bookworm-slim

WORKDIR /app

# Install Python
RUN apt-get update -qq && \
    apt-get install -y -qq --no-install-recommends \
        python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Python deps (ddddocr + onnxruntime)
COPY apps/worker/requirements.txt /tmp/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -i https://pypi.tuna.tsinghua.edu.cn/simple -r /tmp/requirements.txt \
    && rm /tmp/requirements.txt

# Copy built artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY apps/worker/ ./apps/worker/

WORKDIR /app/apps/api
ENV WORKER_DIR=/app/apps/worker
ENV PYTHONUNBUFFERED=1

COPY apps/worker/entrypoint.sh ./entrypoint-runner.sh
RUN chmod +x ./entrypoint-runner.sh

CMD ["./entrypoint-runner.sh"]
