# PG Manager

Multi-tenant PG (Paying Guest) management — residents, rooms, rent, food, expenses.
Single Next.js 15 app, deployed to **Vercel + Supabase** for **₹0/month**.

> **Deploying?** Start with [`MIGRATION.md`](./MIGRATION.md). It's a complete runbook:
> Supabase project setup, Vercel project setup, env vars, the keepalive cron, and a
> "remaining endpoints" checklist with the porting recipe.

---

## Stack (current)

- **Monorepo**: Turborepo + pnpm workspaces
- **Web + API + cron** (`apps/web`): Next.js 15 App Router. Pages, Route Handlers under `app/api/`, scheduled crons via `vercel.json` → deployed to Vercel.
- **Database**: Supabase Postgres (pgBouncer pooler for the app, direct URL for migrations).
- **Auth**: Supabase Auth — email + password, bcrypt-hashed at the provider, httpOnly session cookie.
- **Object storage**: Supabase Storage, private bucket `pg-uploads`, accessed via short-lived signed URLs.
- **Shared packages**: `@pg/db` (Prisma schema + generated client), `@pg/types` (Zod schemas).

**Cost**: Vercel Hobby + Supabase Free + Cloudflare DNS = ₹0. See [MIGRATION.md § Cost](./MIGRATION.md#cost).

---

## Quick start (local dev)

```bash
# 1. Install
corepack enable pnpm
pnpm install

# 2. Set up Supabase (free) — see MIGRATION.md § Phase 1
#    Copy the connection strings + API keys into apps/web/.env.local
cp apps/web/.env.example apps/web/.env.local

# 3. Push the schema to Supabase
pnpm db:generate
pnpm --filter @pg/db prisma migrate deploy

# 4. Dev
pnpm --filter @pg/web dev
# → http://localhost:3000
```

Sign up your owner account on `/signup`, confirm the email, then promote yourself:
```bash
SEED_OWNER_EMAIL=you@example.com pnpm --filter @pg/db prisma db seed
```

---

## Project layout

```
apps/
  web/        Next.js — UI + Route Handlers + Vercel Cron (THIS IS THE APP)
  api/        DEPRECATED — old NestJS API, kept as reference for ports
  worker/     DEPRECATED — old BullMQ worker, kept as reference
packages/
  db/         Prisma schema + generated client + auth-sync SQL migration
  types/      Shared Zod schemas / TS types
.github/
  workflows/  ci.yml, security.yml
  dependabot.yml
vercel.json   Vercel project config (cron schedules)
MIGRATION.md  Step-by-step deploy guide
```

The Route Handlers under `apps/web/src/app/api/` replace the old NestJS controllers.
Business logic lives in `apps/web/src/server/services/` (framework-agnostic functions
that take `prisma` + emit audit log entries). See MIGRATION.md § Phase 7 for the
porting pattern and the list of endpoints still to port.

---

## Security

See [SECURITY.md](./SECURITY.md). Highlights as they apply to the current stack:

- **Auth**: Supabase Auth (bcrypt at provider) + httpOnly session cookie. MFA can be enabled per-user in Supabase.
- **RBAC**: `User.role` = `OWNER` | `MANAGER`. Managers are scoped to specific PGs via `UserPGScope`. Enforced server-side by `assertPgScope()` at every mutating Route Handler.
- **PII at rest**: AES-256-GCM via `PII_ENCRYPTION_KEY` (phone, alt phone, primary-contact phone). HMAC for searchable lookup. Helpers in `apps/web/src/server/common/pii.ts`.
- **Input validation**: Zod schemas at every Route Handler boundary; unknown fields rejected.
- **CSP + headers**: configured in `apps/web/next.config.mjs` (CSP allows `'self'` + Supabase origin only).
- **Audit log**: every mutation writes one row to `audit_logs` via `recordAudit()`, with PII redacted.
- **Cron auth**: `/api/cron/*` endpoints require `Authorization: Bearer ${CRON_SECRET}` — Vercel sends this automatically; nothing else can call them.
- **Supply chain**: pinned versions, frozen lockfile, weekly Dependabot, Trivy + pnpm audit + CodeQL in CI on every PR.

---

## Scripts

| Script | What it does |
|---|---|
| `pnpm --filter @pg/web dev` | Run the Next.js app locally |
| `pnpm --filter @pg/web build` | Production build (Vercel runs this automatically) |
| `pnpm typecheck` | TS strict checks across all packages |
| `pnpm lint` | Lint everything (security plugins enforced) |
| `pnpm db:generate` | Regenerate Prisma client after schema edits |
| `pnpm --filter @pg/db prisma migrate deploy` | Apply migrations to Supabase |
| `pnpm --filter @pg/db prisma db seed` | Promote an existing Supabase user to OWNER (see `prisma/seed.ts`) |
| `pnpm audit` | `pnpm audit --audit-level=high` |

---

## Roadmap

**v1 (in progress)** — auth ✅, PG/floor/room/bed CRUD, resident onboarding stepper ✅, bed map ✅, rent ledger, food management, expenses, dashboards. UI is complete; some Route Handlers still need to be ported from the deprecated NestJS code (see MIGRATION.md § Phase 7 checklist).

**v2** — maintenance/complaints (QR form), inventory, visitor log, GST invoicing, mobile app.

---

## Legacy stack (Docker / NestJS / BullMQ)

The original Docker-based deployment is preserved in `apps/api/`, `apps/worker/`, and `docker/`. It is no longer the supported way to run this app, but the files are kept so:

1. The service-class business logic can be referenced when porting remaining controllers.
2. You can roll back to it locally if Supabase / Vercel are blocked for any reason (see MIGRATION.md § Rollback).

To delete the legacy stack once you're confident on Vercel + Supabase, remove `apps/api/`, `apps/worker/`, `docker/`, and the corresponding deps from the root `package.json`. That cleanup is documented in MIGRATION.md § "What stays, what's deleted".
