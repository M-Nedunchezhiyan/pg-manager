# syntax=docker/dockerfile:1.7
FROM node:22.11.0-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc ./
COPY turbo.json tsconfig.base.json ./
COPY apps/worker/package.json apps/worker/
COPY packages/db/package.json packages/db/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile --prefer-offline

FROM node:22.11.0-alpine AS build
RUN apk add --no-cache libc6-compat openssl
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /repo/packages/db/node_modules ./packages/db/node_modules
COPY . .
RUN pnpm --filter @pg/db prisma generate
RUN pnpm --filter @pg/worker build
RUN pnpm --filter @pg/worker --prod deploy /out

FROM node:22.11.0-alpine AS runtime
RUN apk add --no-cache openssl tini && \
    addgroup -S app && adduser -S -G app app

WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=app:app /out/node_modules ./node_modules
COPY --from=build --chown=app:app /out/dist ./dist
COPY --from=build --chown=app:app /out/package.json ./package.json

USER app
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
