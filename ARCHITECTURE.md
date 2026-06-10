# PG Manager — Architecture

A complete walkthrough of how the system is built and how a request flows
through it: the stack, the monorepo layout, authentication, authorization,
the database, file storage, PII protection, background jobs, and deployment.

> Companion docs: [`NEON_SETUP.md`](./NEON_SETUP.md) (database credentials),
> [`README.md`](./README.md) (quick start), [`SECURITY.md`](./SECURITY.md),
> [`MIGRATION.md`](./MIGRATION.md) (history of how we got here).

---

## 1. What it is

Multi-tenant **PG (Paying Guest / hostel) management**: residents, rooms & beds,
rent & advances, food menus, expenses, notifications. One owner runs one or more
PGs; managers can be scoped to specific PGs.

**Design goals:** run the whole thing for **₹0/month**, deploy from a `git push`,
keep all sensitive data encrypted, and own the auth layer (no per-user SaaS cost).

---

## 2. Stack at a glance

| Concern            | Technology                                                        |
| ------------------ | ----------------------------------------------------------------- |
| App framework      | **Next.js 15** (App Router) — UI + API in one deployable          |
| Hosting            | **Vercel** (serverless functions + edge middleware + cron)        |
| Database           | **Neon** serverless Postgres                                      |
| ORM                | **Prisma 5**                                                      |
| Auth               | **Self-hosted** — argon2id password + signed JWT session cookie   |
| File storage       | **Supabase Storage** (private bucket, signed URLs)                |
| PII at rest        | **AES-256-GCM** field encryption + HMAC for lookups               |
| Background jobs    | **Vercel Cron** → Route Handlers                                  |
| Monorepo           | **Turborepo + pnpm workspaces**                                   |
| Validation         | **Zod** at every boundary                                         |
| Client data        | **TanStack Query** + **axios**                                    |

Cost: Vercel Hobby + Neon Free + Supabase Free + Cloudflare DNS = **₹0**.

---

## 3. Monorepo layout

```
pg-manager/
├── apps/
│   ├── web/          ← THE app: Next.js 15 (UI + /api routes + cron). Deployed to Vercel.
│   ├── api/          ← legacy NestJS API (DEPRECATED, not deployed — kept for rollback)
│   └── worker/       ← legacy BullMQ worker (DEPRECATED — its jobs are now Vercel cron)
├── packages/
│   ├── db/           ← @pg/db: Prisma schema, generated client, seed
│   └── types/        ← @pg/types: shared Zod schemas / TS types
├── docker/           ← local Postgres/Redis/MinIO for the legacy stack
├── NEON_SETUP.md  ARCHITECTURE.md  README.md  SECURITY.md  MIGRATION.md
└── vercel.json       ← build command + cron schedules
```

**Only `apps/web` + `packages/*` are live.** `apps/api` and `apps/worker` are the
previous self-hosted stack, retained for emergency rollback and deleted once the
serverless stack is proven (see MIGRATION.md § Rollback).

### Inside `apps/web/src`

```
app/
  (auth)/login/        ← unauthenticated login page (no public signup)
  (app)/               ← authenticated shell: dashboard, per-PG pages, settings
    pg/[pgId]/...       ← beds, rooms, residents, rent, food, expenses
  api/
    auth/{login,logout,me}/   ← session endpoints
    pgs/...  residents/...    ← business REST endpoints (Route Handlers)
    cron/{keepalive,rent-due-scan}/  ← scheduled jobs
middleware.ts           ← edge auth gate on every page/request
server/
  common/   prisma, session, jwt, scope, audit, pii, cron
  services/ pg.service, resident.service   ← business logic
lib/        api(axios), auth, supabase/*, uploads, sym-cipher, + per-entity clients
components/  sidebar, topbar, mobile-nav, notification-bell, query-provider
```

**Layering rule:** Route Handlers (`app/api/*`) are thin — they authenticate,
validate, delegate to a `server/services/*` function, and shape the response.
Business logic and Prisma access live in `server/`. The browser never touches
Prisma; it calls `/api/*` through the axios client in `lib/api.ts`.

---

## 4. Request lifecycle (end to end)

```
Browser
  │  fetch('/api/...') with httpOnly session cookie (axios, withCredentials)
  ▼
Edge Middleware  (apps/web/src/middleware.ts)
  │  • public path? → pass through
  │  • else verify session JWT (jose, no DB hit). Invalid → 302 /login?next=…
  ▼
Route Handler  (apps/web/src/app/api/**/route.ts)   [Node.js runtime]
  │  1. requireUser()  → re-verify cookie + load fresh User (role, pgScopes) from Neon
  │  2. Zod .safeParse(body)  → 400 on invalid input
  │  3. assertPgScope(pgId, …) → 403 if manager lacks access to this PG
  │  4. call server/services/* (business logic + Prisma)
  │  5. recordAudit(…)  → write a sanitized row to audit_logs
  ▼
Prisma  →  Neon Postgres (pooled connection)
  ▼
JSON response  →  TanStack Query cache  →  React UI
```

Two independent auth checks are deliberate: the **edge** check is fast and gates
page navigation; the **Route Handler** check (`requireUser`) is authoritative,
re-reads the DB so a revoked manager loses access on their very next request, and
provides the role/scopes the handler needs.

A representative handler — `app/api/pgs/route.ts`:

```ts
export async function POST(req: Request) {
  try {
    const user = await requireUser();                 // 401 if not authed
    const parsed = CreatePgSchema.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, …);  // input validation
    const pg = await createPG(parsed.data, user.sub, user.role);  // service layer
    return NextResponse.json(pg, { status: 201 });
  } catch (err) {
    return errorResponse(err);                         // uniform error shape
  }
}
```

---

## 5. Authentication (login & sessions)

Fully self-hosted — **no external auth provider, no per-user cost.** Everything
lives in our own Neon `users` table.

**Components**
- `server/common/jwt.ts` — signs/verifies the session token with **`jose`**
  (HS256, secret = `AUTH_SECRET`). Imports *only* `jose` so it is safe in the
  Edge middleware. Cookie name `pg_session`, 7-day expiry.
- `app/api/auth/login/route.ts` (Node runtime) — verifies the password with
  **argon2id** and sets the cookie.
- `app/api/auth/logout/route.ts` — clears the cookie.
- `app/api/auth/me/route.ts` — returns the current user.
- `server/common/session.ts` — `requireUser()` used by every protected handler.
- `lib/auth.ts` — browser helpers (`login`, `logout`, `fetchMe`).

**Login flow**

```
POST /api/auth/login { email, password }
  → prisma.user.findUnique({ email })
  → argon2.verify(user.passwordHash, password)        // always runs, even on miss
  → invalid → 401 "Invalid email or password"
  → valid   → signSession({ sub, email, name, role })
            → Set-Cookie: pg_session=<JWT>  (httpOnly, SameSite=Lax,
                                              Secure in prod, Max-Age=7d)
  → 200 { id, email, name, role, pgScopes }
```

**Why these choices**
- **argon2id** — OWASP's first-choice password hash; memory-hard, GPU-resistant.
  (`serverExternalPackages: ['argon2']` in `next.config.mjs` keeps the native
  module out of the bundle.)
- **JWT in an httpOnly cookie** — not readable by JS (XSS can't steal it),
  verifiable at the edge without a DB round-trip, `SameSite=Lax` blunts CSRF.
- **Stateless** — there's no session table to manage; logout just deletes the
  cookie. Trade-off: a token can't be individually revoked before expiry, but
  because `requireUser()` re-loads the user and checks `isActive` + role on every
  request, deactivating a user takes effect immediately regardless of the token.

**Provisioning the account (no public signup).** There is exactly one (or a few)
operator account(s), created by the seed:

```bash
SEED_OWNER_EMAIL=you@example.com \
SEED_OWNER_PASSWORD='a-strong-password' \
pnpm --filter @pg/db prisma db seed
```

The seed argon2-hashes the password and upserts an `OWNER` row. Re-running with a
new password resets it.

---

## 6. Authorization (permissions)

Authorization is separate from authentication and lives entirely in the database
schema + a couple of guards.

- **Roles** — `User.role` ∈ { `OWNER`, `MANAGER` }.
- **PG scoping** — `UserPGScope(userId, pgId)` lists which PGs a MANAGER may
  access. OWNER bypasses scoping entirely.
- **Enforcement** — `server/common/scope.ts`:

  ```ts
  export async function assertPgScope(pgId, userId, role) {
    if (role === UserRole.OWNER) return;               // owner sees all
    const scope = await prisma.userPGScope.findUnique({
      where: { userId_pgId: { userId, pgId } },
    });
    if (!scope) throw new HttpError(403, 'No access to this PG');
  }
  ```

  Every mutating handler that targets a specific PG calls this before acting.

The session JWT carries the role for convenience, but the **authoritative** role
and scopes always come from the freshly-loaded `User` row in `requireUser()`.

---

## 7. Database (Neon + Prisma)

- **Provider:** Neon serverless Postgres. **ORM:** Prisma 5.
- **Two connection strings** (`packages/db/prisma/schema.prisma`):
  - `DATABASE_URL` → Neon **pooled** endpoint (`-pooler` host) — used at runtime;
    required because serverless functions open many short-lived connections.
  - `DIRECT_URL` → Neon **direct** endpoint — used only by Prisma for schema
    changes (`db push` / `migrate`), which can't run over the transaction pooler.
- **Client singleton:** `packages/db/src/index.ts` exports one `PrismaClient`
  (cached on `globalThis` in dev to survive HMR). `apps/web/src/server/common/prisma.ts`
  re-exports it so handlers import from `@/server/common/prisma`.
- **Schema conventions:** singular models, `snake_case` columns via `@map`, money
  stored as **INR paise (Int)** — never floats, IDs are CUIDs.
- **Schema sync:** this repo has no migration history, so `prisma db push` diffs
  the schema straight onto Neon. (Generate a baseline with `migrate dev --name
  init` if/when you want versioned migrations.)

**Core data model** (see `schema.prisma` for the full definition):

```
User ─< UserPGScope >─ PG ─┬─< Floor ─< Room ─< Bed ─< Allocation >─ Resident
                           ├─< SharingType (rent tiers)
                           ├─< PGSettings (advance months, late fee, notice days)
                           ├─< FoodGroup ─< FoodGroupItem >─ FoodItem
                           ├─< DailyMenu ─< DailyMenuItem >─ FoodItem
                           └─< Expense
Resident ─┬─< Payment   (RENT / ADVANCE / LATE_FEE / REFUND / ADJUSTMENT, paise)
          └─< Advance
User ─< Notification          AuditLog (who did what, PII-stripped)
```

---

## 8. File storage (Supabase Storage)

The DB and auth are on Neon; **only file storage** still uses Supabase (its free
private object store + signed URLs are a good fit, and it keeps the cost at ₹0).

`lib/uploads.ts`:
- **Bucket:** `pg-uploads`, **private**. Categories: resident photo, ID proof,
  PG image, expense receipt. Per-category MIME allow-list, 10 MB cap.
- **Upload:** browser → Supabase Storage directly; the app stores only the
  **object path**, never a public URL.
- **Display:** `signUrl(path)` mints a **1-hour signed URL** on render. Files are
  never world-readable.

The Supabase keys (`NEXT_PUBLIC_SUPABASE_URL`, anon key, service-role key) are now
used *solely* for Storage. (Swappable for any S3-compatible store later.)

---

## 9. PII protection

Resident data includes phone numbers and ID-proof details. These are never stored
in plaintext.

- **`server/common/pii.ts`** (server-only, key = `PII_ENCRYPTION_KEY`, 32 bytes):
  - `encryptPII()` / `decryptPII()` — **AES-256-GCM**, output `base64(iv|tag|ct)`.
  - `hashPII()` — deterministic **HMAC-SHA256** for *searchable* fields. e.g.
    `phoneHash` is unique-indexed so we can look a resident up by phone without
    ever decrypting, while `phoneEncrypted` holds the recoverable value.
- **`lib/sym-cipher.ts`** (browser, key = `NEXT_PUBLIC_SHARED_CIPHER_KEY`) — a
  matching AES-256-GCM cipher used to wrap opaque IDs/tokens so they don't appear
  as raw text in DevTools. This is **obfuscation, not secrecy** (the key ships in
  the bundle); real protection is HTTPS + httpOnly cookies + server auth.
- **Audit redaction** — `server/common/audit.ts` strips a PII_KEYS denylist
  (`passwordHash`, `phoneEncrypted`, `idProofUrl`, …) before writing `audit_logs`,
  and stores only an **HMAC of the client IP**, never the raw IP.

---

## 10. Background jobs (Vercel Cron)

Defined in `vercel.json`; each is a Route Handler guarded by `CRON_SECRET`
(`server/common/cron.ts` checks `Authorization: Bearer <secret>` that Vercel
sends automatically — nothing else can invoke them).

| Path                        | Schedule        | Purpose                                                              |
| --------------------------- | --------------- | ------------------------------------------------------------------- |
| `/api/cron/rent-due-scan`   | `0 6 * * *`     | Notify owner + scoped managers of residents whose rent is due today/tomorrow. **Idempotent** via a `dedupKey` on the notification. |
| `/api/cron/keepalive`       | `0 */4 * * *`   | `SELECT 1` against Neon every 4 h so the free-tier compute doesn't scale-to-zero and cold-start. |

These replace the old BullMQ worker (`apps/worker`, deprecated).

---

## 11. Frontend

- **App Router** with two route groups: `(auth)` (login) and `(app)` (the
  authenticated shell — sidebar, topbar, mobile nav, notification bell).
- **Data fetching:** `lib/api.ts` is an axios instance (`baseURL: /api`,
  `withCredentials`). A response interceptor catches `401` and bounces to
  `/login?next=…`. Per-entity client modules (`lib/residents.ts`, `lib/pgs.ts`,
  `lib/payments.ts`, …) wrap the endpoints; **TanStack Query** handles caching,
  loading, and refetch.
- **Forms:** react-hook-form + Zod resolvers; the same Zod schemas validate again
  server-side, so the client can never bypass validation.

---

## 12. Security summary

| Layer            | Control                                                                       |
| ---------------- | ----------------------------------------------------------------------------- |
| Transport        | HTTPS everywhere; HSTS in production                                           |
| Session          | httpOnly + Secure + SameSite=Lax JWT cookie, signed HS256 with `AUTH_SECRET`   |
| Passwords        | argon2id hash, stored in Neon, never logged                                    |
| AuthZ            | Role (`OWNER`/`MANAGER`) + per-PG `UserPGScope`, enforced by `assertPgScope`   |
| Input            | Zod `.safeParse` at every Route Handler; unknown fields rejected               |
| PII at rest      | AES-256-GCM (`PII_ENCRYPTION_KEY`) + HMAC for searchable fields                |
| Audit            | every mutation → `audit_logs`, PII-stripped, IP stored as HMAC only            |
| Headers / CSP    | `next.config.mjs`: CSP `'self'` + Supabase Storage origin, X-Frame-Options DENY, nosniff, no-referrer |
| Cron             | `/api/cron/*` requires `Authorization: Bearer ${CRON_SECRET}`                  |
| Supply chain     | pinned versions, frozen lockfile, Dependabot, Trivy + pnpm audit + CodeQL in CI |

---

## 13. Environment variables

| Var                                 | Where        | Purpose                                            |
| ----------------------------------- | ------------ | -------------------------------------------------- |
| `DATABASE_URL`                      | server       | Neon **pooled** connection (runtime)               |
| `DIRECT_URL`                        | server       | Neon **direct** connection (migrations / db push)  |
| `AUTH_SECRET`                       | server       | Signs the session JWT (min 32 chars)               |
| `PII_ENCRYPTION_KEY`                | server       | AES-256-GCM + HMAC key (64 hex chars)              |
| `SHARED_CIPHER_KEY` / `NEXT_PUBLIC_SHARED_CIPHER_KEY` | server / browser | ID/token obfuscation cipher |
| `CRON_SECRET`                       | server       | Authorizes Vercel cron calls                       |
| `NEXT_PUBLIC_SUPABASE_URL` / anon / service-role | mixed | Supabase **Storage** only                      |
| `NEXT_PUBLIC_APP_URL`               | both         | App base URL for links                             |
| `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` | seed   | Provision the owner login                          |

See `apps/web/.env.example` (deploy) and `.env.example` (root) for the full set.

---

## 14. Deployment (Vercel)

1. `vercel.json` sets `buildCommand: pnpm --filter @pg/web build`,
   `installCommand: pnpm install --frozen-lockfile`, framework `nextjs`,
   output `apps/web/.next`, and the two cron schedules.
2. Set all env vars in Vercel → Project Settings → Environment Variables
   (`DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `PII_ENCRYPTION_KEY`,
   `CRON_SECRET`, Supabase Storage keys).
3. `prisma generate` runs in the build (`turbo` `^db:generate` dependency);
   schema changes reach Neon via `prisma db push` (run from your machine or CI).
4. `git push` → Vercel builds & deploys; cron jobs are registered automatically.

---

## 15. Legacy / deprecated

`apps/api` (NestJS) and `apps/worker` (BullMQ), plus `docker/` (Postgres, Redis,
MinIO), are the original self-hosted stack. They are **not deployed** and are kept
only for rollback. The Prisma schema is shared, so the old API can point at a
Postgres instance if ever needed. Delete them once the serverless stack is proven
(MIGRATION.md § "What stays, what's deleted").
