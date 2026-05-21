# PG Manager

Multi-tenant PG (Paying Guest) management — residents, rooms, rent, food, expenses.
Built security-first: every commit passes pnpm audit + Trivy + gitleaks + CodeQL.

## Stack

- **Monorepo**: Turborepo + pnpm workspaces
- **Web** (`apps/web`): Next.js 15 (App Router) + Tailwind + shadcn-style UI, light-green/white theme
- **API** (`apps/api`): NestJS 10 + Prisma + PostgreSQL, Argon2id auth, JWT in httpOnly cookies
- **Worker** (`apps/worker`): BullMQ + node-cron for rent-due scans & notifications
- **Data**: PostgreSQL 16, Redis 7, MinIO (S3-compatible) — all on internal Docker network
- **Shared packages**: `@pg/db` (Prisma), `@pg/types` (Zod schemas)

## Quick start (dev)

```bash
# 1. Install
pnpm install

# 2. Copy env and fill in secrets
cp .env.example .env
# generate real secrets:
#   openssl rand -base64 48   # JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, NEXTAUTH_SECRET
#   openssl rand -hex 32      # PII_ENCRYPTION_KEY (must be 64 hex chars)

# 3. Boot infra
pnpm docker:up

# 4. Database
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# 5. Dev (api + web + worker)
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:4000  (health: `/health`, ready: `/readyz`)
- Adminer (DB UI, dev only): `docker compose -f docker/docker-compose.yml --profile dev-tools up adminer`
- MinIO console: http://localhost:9001

## Project layout

```
apps/
  api/        NestJS — REST + websockets
  web/        Next.js — admin dashboard
  worker/     BullMQ jobs
packages/
  db/         Prisma schema + client
  types/      Shared Zod schemas / TS types
docker/       docker-compose.yml + future prod overrides
.github/
  workflows/  ci.yml, security.yml
  dependabot.yml
```

## Security

See [SECURITY.md](./SECURITY.md). Highlights:

- **Auth**: Argon2id, httpOnly+Secure+SameSite=strict cookies, rotating refresh tokens, lockout after failures.
- **RBAC**: Owner / Manager; managers scoped to specific PGs at row level.
- **PII at rest**: AES-256-GCM via `PII_ENCRYPTION_KEY` (phone, alt phone, primary contact). HMAC for searchable lookup.
- **Validation**: Zod at every API boundary; unknown fields rejected.
- **Headers**: helmet + Next custom headers — CSP, HSTS (prod), X-Frame-Options=DENY, etc.
- **Rate limits**: `@nestjs/throttler` global + per-auth route.
- **Logging**: pino with PII redaction; no secrets, no auth headers, no ID numbers.
- **Audit log**: every mutation captured with actor, entity, before/after.
- **Supply chain**: pinned versions, frozen lockfile, weekly Dependabot, daily Trivy + pnpm audit in CI, CodeQL on every PR.
- **Docker**: non-root user, minimal alpine base, no secrets baked in, healthchecks.

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Run api + web + worker in watch mode |
| `pnpm build` | Build all apps |
| `pnpm lint` | Lint everything (security plugins enforced) |
| `pnpm typecheck` | TS strict checks |
| `pnpm test` | Run all tests |
| `pnpm audit` | `pnpm audit --audit-level=high` |
| `pnpm db:migrate` | Run dev migrations |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm docker:up` / `:down` / `:logs` | Manage local infra |

## Roadmap

**v1 (in progress)** — auth, PG/floor/room/bed CRUD, resident onboarding stepper, bed map, rent ledger, food management, expenses, dashboards.

**v2** — maintenance/complaints (QR form), inventory, visitor log, WhatsApp/SMS notifications, GST invoicing, mobile app.
