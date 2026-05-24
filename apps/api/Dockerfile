# syntax=docker/dockerfile:1.7
# ─── Stage 1: deps ─────────────────────────────────────────────────────────
FROM node:26.2.0-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /repo

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc ./
COPY turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/types/package.json packages/types/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile --prefer-offline

# ─── Stage 2: build ────────────────────────────────────────────────────────
FROM node:26.2.0-alpine AS build
RUN apk add --no-cache libc6-compat openssl
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /repo/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /repo/packages/types/node_modules ./packages/types/node_modules

COPY . .

RUN pnpm --filter @pg/db prisma generate
RUN pnpm --filter @pg/api build

# Prune to production deps only
RUN pnpm --filter @pg/api --prod deploy /out

# ─── Stage 3: runtime ──────────────────────────────────────────────────────
FROM node:26.2.0-alpine AS runtime
RUN apk add --no-cache openssl tini && \
    addgroup -S app && adduser -S -G app app

WORKDIR /app
ENV NODE_ENV=production \
    NODE_OPTIONS="--enable-source-maps" \
    NPM_CONFIG_UPDATE_NOTIFIER=false

COPY --from=build --chown=app:app /out/node_modules ./node_modules
COPY --from=build --chown=app:app /out/dist ./dist
COPY --from=build --chown=app:app /out/package.json ./package.json
COPY --from=build --chown=app:app /repo/packages/db/prisma ./packages/db/prisma

USER app
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:4000/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
