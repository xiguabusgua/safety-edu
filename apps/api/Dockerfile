# =============================================================================
# safety-edu API Dockerfile
# Pre-built: dist/ + node_modules created on Mac, uploaded to server.
# Docker 只负责运行，不 build。
# =============================================================================
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl

# Copy pre-built artifacts (x86 node_modules from Docker builder)
COPY apps/api/dist ./apps/api/dist
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/entrypoint.sh ./apps/api/entrypoint.sh
COPY apps/web/dist ./apps/web/dist

# Copy node_modules (pre-built via Docker on server)
COPY node_modules ./node_modules

WORKDIR /app/apps/api
EXPOSE 3002
RUN chmod +x ./entrypoint.sh

CMD ["./entrypoint.sh"]
