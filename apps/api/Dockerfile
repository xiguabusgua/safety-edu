# =============================================================================
# safety-edu API Dockerfile
#
# Builds the Express API + frontend static files in a multi-stage build.
# In production, the API serves both /api/* routes and the SPA frontend.
# =============================================================================

# ---- Builder Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@9.12.0 --registry=https://registry.npmmirror.com && \
    apk add --no-cache python3 make g++

# 1. Cached dependency install
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/web/package.json ./apps/
COPY packages/shared-types/package.json ./packages/shared-types/

RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install

# 2. Source code
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
COPY apps/web/ ./apps/web/

# 3. Generate Prisma client (run from root to avoid workspace symlink issues)
RUN pnpm --filter api prisma generate

# 4. Build web (use pnpm --filter, not npm, for workspace consistency)
RUN pnpm --filter web build

# 5. Build api (tsc)
RUN pnpm --filter api build

# ---- Production Stage ----
FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm@9.12.0 --registry=https://registry.npmmirror.com && \
    apk add --no-cache openssl

# Copy workspace config for pnpm runtime resolution
COPY --from=builder /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/package.json ./

# Copy the pnpm store + root node_modules (preserves symlink targets)
COPY --from=builder /app/node_modules ./node_modules

# Copy sub-package node_modules (symlinks to root .pnpm store — preserved!)
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/apps/web/dist ./apps/web/dist

# Cleanup: remove api source (only dist needed at runtime)
RUN rm -rf /app/apps/api/src /app/apps/api/tsconfig.json

WORKDIR /app/apps/api
EXPOSE 3002

COPY apps/api/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

CMD ["./entrypoint.sh"]
