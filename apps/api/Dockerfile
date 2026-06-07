# =============================================================================
# safety-edu API Dockerfile
#
# Multi-stage: pre-build on builder (x86) → copy dist to minimal runtime.
# =============================================================================

# ---- Builder Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

# Install deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared-types/package.json ./packages/shared-types/

RUN npm install --legacy-peer-deps

# Source
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
COPY apps/web/ ./apps/web/

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build web and api
RUN cd apps/web && npm run build
RUN cd apps/api && npm run build

# ---- Production Stage ----
FROM node:20-alpine

WORKDIR /app
RUN apk add --no-cache openssl

# Copy pre-built artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/entrypoint.sh ./apps/api/entrypoint.sh
COPY --from=builder /app/apps/web/dist ./apps/web/dist

WORKDIR /app/apps/api
EXPOSE 3002
RUN chmod +x ./entrypoint.sh

CMD ["./entrypoint.sh"]
