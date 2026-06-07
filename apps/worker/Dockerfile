# =============================================================================
# safety-edu Runner Dockerfile
# Pre-built: dist/ created on Mac, uploaded to server.
# =============================================================================
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

# Copy pre-built artifacts
COPY apps/api/dist ./apps/api/dist
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/node_modules ./apps/api/node_modules
COPY apps/worker/ ./apps/worker/

WORKDIR /app/apps/api
ENV WORKER_DIR=/app/apps/worker
ENV PYTHONUNBUFFERED=1

COPY apps/worker/entrypoint.sh ./entrypoint-runner.sh
RUN chmod +x ./entrypoint-runner.sh

CMD ["./entrypoint-runner.sh"]
