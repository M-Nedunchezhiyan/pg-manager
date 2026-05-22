# Migration: pg-manager → Supabase + Vercel (free tier)

Goal: take the current stack (NestJS API + BullMQ worker + Postgres + Redis + MinIO + custom auth) and run **all of it for ₹0** on Vercel + Supabase, deployable from a `git push`.

```
BEFORE                                      AFTER
─────────────────────────────────           ─────────────────────────────────
apps/web      → docker (Next.js)            apps/web      → Vercel (Next.js
apps/api      → docker (NestJS)               + Route Handlers + Cron)
apps/worker   → docker (BullMQ)             Postgres      → Supabase Postgres
Postgres      → docker                      Auth          → Supabase Auth
Redis         → docker                      Storage       → Supabase Storage
MinIO         → docker                      DELETED       → apps/api, apps/worker,
                                                            docker/, Redis, MinIO
```

Everything you need to do is in here, in order. Skip nothing on a first run.

---

## 0. Prerequisites

You need these accounts. All free.

| Account | Why | Sign-up |
|---|---|---|
| **GitHub** | Code host + Vercel integration | https://github.com/signup |
| **Supabase** | Postgres + Auth + Storage | https://supabase.com — sign in with GitHub |
| **Vercel** | Web + API hosting + Cron | https://vercel.com — sign in with GitHub |
| **Cloudflare** *(optional)* | DNS + free TLS proxy if you own a domain | https://dash.cloudflare.com/sign-up |

You also need local: `node ≥20`, `pnpm` (via corepack), `git`.

---

## Phase 1 — Supabase project setup

### 1.1 Create the project

1. Go to https://supabase.com/dashboard → **New project**.
2. Organization: pick or create one (free).
3. **Project name**: `pg-manager` (anything; just a label).
4. **Database password**: click **Generate a password** → **copy and save it now**. You won't see it again. Store in a password manager. This becomes `SUPABASE_DB_PASSWORD`.
5. **Region**: pick the one closest to your users.
   - For India: **Mumbai (ap-south-1)** — closest, lowest latency.
   - If unavailable, **Singapore (ap-southeast-1)**.
6. **Pricing plan**: **Free**.
7. Click **Create new project** and wait ~2 minutes for provisioning.

### 1.2 Collect the four values you need

When the project is ready, go to **Project Settings → API** in the left nav. Copy these:

| Value in the dashboard | Env var name | Used by |
|---|---|---|
| **Project URL** (e.g. `https://abcde.supabase.co`) | `NEXT_PUBLIC_SUPABASE_URL` | Browser + server |
| **Project API keys → anon public** | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser (safe to expose; RLS protects data) |
| **Project API keys → service_role** ⚠️ | `SUPABASE_SERVICE_ROLE_KEY` | Server only (bypasses RLS — treat like root password, NEVER ship to browser) |

Then go to **Project Settings → Database** and copy:

| Value | Env var | Notes |
|---|---|---|
| **Connection string → URI** (Session mode, port 5432) | `DIRECT_URL` | For Prisma migrations |
| **Connection string → URI** (Transaction mode, port 6543) | `DATABASE_URL` | For runtime — uses pgBouncer; required by Vercel's serverless |

In both URIs, replace `[YOUR-PASSWORD]` with the password you saved in step 1.1. Append `?pgbouncer=true&connection_limit=1` to `DATABASE_URL`.

### 1.3 Create the Storage bucket

1. Left nav → **Storage** → **New bucket**.
2. Name: `pg-uploads`.
3. **Public bucket**: **OFF** (we'll use signed URLs).
4. Click **Create**.

### 1.4 Enable the auth providers you want

1. Left nav → **Authentication → Providers**.
2. **Email** is enabled by default. Good.
3. *(Optional)* Enable **Phone** if you want OTP login later.
4. Left nav → **Authentication → URL Configuration**.
   - **Site URL**: your Vercel URL once deployed (e.g. `https://pg-manager-yourname.vercel.app`). For now put `http://localhost:3000`.
   - **Redirect URLs**: add `http://localhost:3000/**` and the Vercel URL with `/**`.

### 1.5 Run the schema

In the local repo, after env is configured (Phase 3 below), you'll run `pnpm db:migrate deploy` which pushes the existing Prisma schema to Supabase. Don't do it now — comes in Phase 4.

---

## Phase 2 — GitHub + Vercel setup

### 2.1 Push the repo to GitHub

```bash
cd pg-manager
git init                     # if not already a git repo
git add .
git commit -m "Initial: pg-manager v1"
gh repo create pg-manager --private --source=. --remote=origin --push
# OR manually: create the repo on github.com, then:
# git remote add origin git@github.com:<you>/pg-manager.git
# git branch -M main && git push -u origin main
```

### 2.2 Create the Vercel project

1. Go to https://vercel.com/new.
2. **Import Git Repository** → pick `pg-manager`.
3. **Configure project**:
   - **Framework Preset**: Next.js (auto-detected).
   - **Root Directory**: `apps/web` ← **important**, this is a monorepo.
   - **Build Command**: leave default (`next build`).
   - **Install Command**: `pnpm install --frozen-lockfile`.
   - **Output Directory**: leave default (`.next`).
4. **Environment Variables**: leave blank for now; we'll add them in Phase 3.
5. Click **Deploy**. The first deploy will fail (no env vars) — that's expected.

### 2.3 Lock the build to pnpm

In Vercel project → **Settings → General → Node.js Version**: pick **20.x**.  
In **Settings → General → Package Manager**: **pnpm** (Vercel auto-detects from `pnpm-lock.yaml`).

---

## Phase 3 — Environment variables

There are two places to set these: **locally** (`.env.local` in `apps/web/`) and **on Vercel** (Project → Settings → Environment Variables).

Use `apps/web/.env.example` as the source of truth.

| Name | Where to get it | Scope |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | Production + Preview + Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API | Production + Preview + Development |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | **Production + Preview only**, never Development if you fear key leaks |
| `DATABASE_URL` | Supabase → Settings → Database (port 6543, +pgbouncer flags) | All |
| `DIRECT_URL` | Supabase → Settings → Database (port 5432) | All (Prisma migrations) |
| `PII_ENCRYPTION_KEY` | Generate: `openssl rand -hex 32` | All — same value across all environments |
| `CRON_SECRET` | Generate: `openssl rand -base64 32` | Production — protects cron endpoints |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` locally; your `*.vercel.app` URL in prod | All |

After setting on Vercel, **redeploy** (Deployments → Latest → ⋯ → Redeploy).

---

## Phase 4 — Database connection + migration

```bash
# Locally, with apps/web/.env.local filled in:
cd packages/db
pnpm prisma migrate deploy     # applies all migrations to Supabase
pnpm prisma db seed            # optional: seed a default owner
```

If you don't have `prisma/migrations/` folder yet (only `schema.prisma`), first generate the initial migration locally:

```bash
pnpm prisma migrate dev --name init
# Then commit the migrations folder.
```

Vercel runs `prisma generate` automatically on each build via the postinstall hook. No migrations run on Vercel — keep `migrate deploy` as a manual or CI step (safer than auto-migrating on every deploy).

---

## Phase 5 — Auth replacement

**Removed from web:** the custom `/api/v1/auth/*` endpoints, Argon2 hashing, JWT cookie issuing, refresh token rotation, custom 2FA QR generation.

**Added:** Supabase Auth via `@supabase/auth-helpers-nextjs`. Supabase handles:
- Email + password login (bcrypt-hashed server-side at Supabase)
- Email confirmation / password reset (Supabase sends the emails)
- Session cookies (httpOnly, set by Supabase)
- MFA (TOTP) — built in, can be enabled per-user later
- Rate limiting per project

**What you keep:** the `User` table for app-specific data (role, scoped PG access). A new column links `User.id` to Supabase's `auth.users.id` (both are UUIDs). A Postgres trigger auto-creates a `User` row whenever someone signs up.

Code changes (already done in this branch):
- `apps/web/src/lib/supabase/{client,server,admin}.ts` — three clients.
- `apps/web/src/middleware.ts` — validates Supabase session cookie.
- `apps/web/src/app/(auth)/login/page.tsx` — uses `supabase.auth.signInWithPassword`.
- Login → `/` redirect chain stays the same.
- Removed: `apps/web/src/lib/auth.ts` (custom JWT helpers) — replaced by `lib/supabase/auth.ts`.

---

## Phase 6 — Storage replacement (MinIO → Supabase Storage)

- `apps/web/src/lib/uploads.ts` now calls Supabase Storage:
  ```ts
  const { data } = await supabase.storage.from('pg-uploads').upload(path, file);
  const { data: signed } = await supabase.storage.from('pg-uploads').createSignedUrl(path, 60 * 60);
  ```
- Bucket is **private**; the app generates short-lived signed URLs (1 h) when displaying photos / ID proofs.
- File size limits & MIME validation moved into the route handler.

---

## Phase 7 — API ported to Route Handlers

NestJS controllers → Next.js Route Handlers under `apps/web/src/app/api/`.

**Pattern** (use this for any controller you port next):

```
NestJS                                Next.js Route Handler
─────────                             ─────────────────────
@Controller({path: 'residents'})      apps/web/src/app/api/residents/route.ts
  @Get()                                export async function GET(req: NextRequest) {…}
  @Post('onboard')                    apps/web/src/app/api/residents/onboard/route.ts
                                        export async function POST(req: NextRequest) {…}
  @Get(':id')                         apps/web/src/app/api/residents/[id]/route.ts
                                        export async function GET(req, { params }) {…}
```

Each handler:
1. Reads the Supabase session: `const { data: { user } } = await supabase.auth.getUser()`.
2. Loads the app-level `User` row (with role + scopes) using `prisma.user.findUnique({where: { authId: user.id }, include: { pgScopes: true }})`.
3. Calls the same service-class method as the NestJS controller did.
4. Returns `NextResponse.json(result)`.

**Done in this commit** — endpoints that already work after deploy:

| Method + path | Handler file |
|---|---|
| `GET  /api/auth/me` | `app/api/auth/me/route.ts` |
| `GET  /api/pgs` | `app/api/pgs/route.ts` |
| `POST /api/pgs` | same |
| `GET  /api/pgs/[pgId]` | `app/api/pgs/[pgId]/route.ts` |
| `PATCH /api/pgs/[pgId]` | same |
| `DELETE /api/pgs/[pgId]` | same |
| `PUT  /api/pgs/[pgId]/settings` | `app/api/pgs/[pgId]/settings/route.ts` |
| `GET  /api/residents?pgId=…&search=…&status=…` | `app/api/residents/route.ts` |
| `POST /api/residents/onboard` | `app/api/residents/onboard/route.ts` |
| `GET  /api/residents/[id]` | `app/api/residents/[id]/route.ts` |
| `PATCH /api/residents/[id]` | same |
| `POST /api/residents/[id]/notice` | `app/api/residents/[id]/notice/route.ts` |
| `DELETE /api/residents/[id]/notice` *(cancel notice)* | same |
| `POST /api/residents/[id]/relieve` | `app/api/residents/[id]/relieve/route.ts` |
| `GET  /api/cron/rent-due-scan` *(auth: CRON_SECRET)* | `app/api/cron/rent-due-scan/route.ts` |
| `GET  /api/cron/keepalive` *(auth: CRON_SECRET)* | `app/api/cron/keepalive/route.ts` |

**Remaining to port** — same pattern as PGs/Residents. Each follows the recipe in `pg.service.ts` + `app/api/pgs/route.ts`:

| Lib call from apps/web/src/lib/ | Needed Route Handler | Service source to port |
|---|---|---|
| `floors.ts: listFloors, createFloor, updateFloor, deleteFloor` | `/api/floors`, `/api/floors/[id]` | `apps/api/src/modules/floor/floor.service.ts` |
| `floors.ts: listSharingTypes, createSharingType, updateSharingType, deleteSharingType` | `/api/sharing-types`, `/api/sharing-types/[id]` | `apps/api/src/modules/sharing-type/sharing-type.service.ts` |
| `rooms.ts: listRoomsByPg, createRoom, updateRoom, deleteRoom` | `/api/rooms`, `/api/rooms/[id]` | `apps/api/src/modules/room/room.service.ts` |
| `rooms.ts: getBedMap, updateBed` | `/api/beds/map`, `/api/beds/[id]` | `apps/api/src/modules/bed/bed.service.ts` |
| `payments.ts: getLedger, getPGDues, listPaymentsForResident, recordPayment` | `/api/payments/ledger/[id]`, `/api/payments/dues`, `/api/payments/resident/[id]`, `/api/payments` | `apps/api/src/modules/payment/payment.service.ts` |
| `expenses.ts: listExpenses, createExpense, deleteExpense` | `/api/expenses`, `/api/expenses/[id]` | `apps/api/src/modules/expense/expense.service.ts` |
| `food.ts: items/groups/menus + apply-defaults` | `/api/food/items[/...]`, `/api/food/groups[/...]`, `/api/food/menus[/...]` | `apps/api/src/modules/food/food.service.ts` |
| `notifications.ts: list, read, read-all` | `/api/notifications[/...]` | `apps/api/src/modules/notification/notification.service.ts` |
| `// dashboard fetch is inlined in pg/[pgId]/page.tsx` | `/api/dashboard/pg/[pgId]` | `apps/api/src/modules/dashboard/dashboard.service.ts` |

**Porting recipe** (~5 minutes per endpoint):

1. Copy `apps/api/src/modules/<X>/<X>.service.ts` → `apps/web/src/server/services/<X>.service.ts`.
2. Strip NestJS DI: remove `@Injectable()`, change `constructor(prisma, audit)` to plain function imports of `prisma` from `@/server/common/prisma` and `recordAudit` from `@/server/common/audit`.
3. Replace NestJS exceptions (`NotFoundException`, `ForbiddenException`, `BadRequestException`, `ConflictException`) with `throw new HttpError(<status>, <msg>)` from `@/server/common/session`.
4. Move the DTO Zod schemas inline (or import from `apps/api/src/modules/<X>/<X>.dto.ts` if you want zero duplication).
5. Create the Route Handler files mirroring the NestJS controller verbs. The template is `app/api/pgs/route.ts`:
   ```ts
   export async function GET(req: Request) {
     try {
       const user = await requireUser();
       const result = await myServiceFn(user.sub, user.role);
       return NextResponse.json(result);
     } catch (err) { return errorResponse(err); }
   }
   ```
6. For mutating endpoints, pass `reqMeta(req)` as the last arg so audit logs capture IP + UA.

That's the whole pattern. The build will pass as long as the file paths match what `lib/*.ts` calls.

---

## Phase 8 — Worker → Vercel Cron

`apps/worker` is deleted. Its only job (`rent-due.scan.ts`) becomes a Vercel-scheduled Route Handler.

**File:** `apps/web/src/app/api/cron/rent-due-scan/route.ts`

**Schedule:** `vercel.json` at repo root:

```json
{
  "crons": [
    { "path": "/api/cron/rent-due-scan", "schedule": "0 6 * * *" },
    { "path": "/api/cron/keepalive",      "schedule": "0 */4 * * *" }
  ]
}
```

(`0 6 * * *` = 06:00 UTC daily = 11:30 IST.)

Cron endpoints check for `Authorization: Bearer ${CRON_SECRET}` — Vercel sends this header automatically.

---

## Phase 9 — Deploy + smoke test

```bash
git add .
git commit -m "feat: migrate to Supabase + Vercel"
git push
```

Vercel builds + deploys on push. When green:

1. Open `https://<your>.vercel.app/login` — should load.
2. Sign up a user (the page now has a "Create account" link; first user can be promoted to OWNER manually in Supabase Table Editor → `users` → set `role = 'OWNER'`).
3. Create a PG. Verify it's visible only to your account (sign out → sign in as a second user → confirm they see no PGs).
4. Upload a resident photo. Verify it loads (signed URL works).
5. Visit `/api/cron/keepalive` directly with `Authorization: Bearer <secret>` to confirm cron path is reachable.

---

## The one tradeoff — and the fix

**Supabase free tier pauses your project after 7 days of no activity.** When paused, the next request fails until you click "Restore" in the dashboard. Annoying.

**Fix: the keepalive cron we just added.** Every 4 hours, Vercel hits `/api/cron/keepalive`, which runs one tiny query (`SELECT 1`) against Supabase. That counts as activity. The project never pauses.

Cost of the cron: well under the Vercel free tier (100 GB-hours/month). With a 4-hourly ping that completes in <50 ms, you use ~0.001 GB-h per month. Free indefinitely.

---

## Rollback

The old Docker-based stack is still in the repo (`apps/api`, `apps/worker`, `docker/`) — just not deployed. If something on Vercel/Supabase blocks you:

1. `pnpm docker:up` to bring up the old stack locally.
2. The Prisma schema is identical → point old `DATABASE_URL` at the old local Postgres and you're back.
3. Once you've confirmed Vercel + Supabase work, you can delete `apps/api`, `apps/worker`, `docker/`, `redis`, `minio` dependencies. That's the cleanup commit.

Until you do that cleanup, you can keep both paths working.

---

## What stays, what's deleted

**Stays:**
- `apps/web/` — your entire frontend, untouched
- `packages/db/` — Prisma schema, just points at Supabase now
- `packages/types/` — shared Zod schemas
- The whole `app/(app)/pg/[pgId]/*` per-PG UI

**Deleted (after verification):**
- `apps/api/` — NestJS server
- `apps/worker/` — BullMQ worker
- `docker/` — docker-compose, Dockerfiles
- All `@nestjs/*` deps in root `package.json`
- `bullmq`, `ioredis`, `argon2`, `minio` deps
- `JWT_*`, `REDIS_*`, `MINIO_*`, `NEXTAUTH_*`, `STORAGE_ROOT` env vars

**Added:**
- `@supabase/supabase-js`, `@supabase/ssr`
- `apps/web/src/lib/supabase/*`
- `apps/web/src/server/services/*` (ported service logic)
- `apps/web/src/app/api/*` (Route Handlers)
- `apps/web/src/app/api/cron/*` (scheduled endpoints)
- `vercel.json` at repo root

---

## Cost

| Item | Cost |
|---|---|
| Vercel Hobby (web + API + cron) | ₹0 |
| Supabase Free (Postgres + Auth + Storage) | ₹0 |
| Cloudflare DNS (optional) | ₹0 |
| Domain (optional) | ~₹800/yr |
| **Total fixed cost** | **₹0** |

You stay on the free tier indefinitely with this app's scale. Real costs only kick in if:
- DB > 500 MB (≈ 50k residents worth of data — far away)
- Storage > 1 GB (≈ 500 ID photos at 2 MB each — far away)
- Egress > 5 GB/month
- Auth MAU > 50 000

At that point you'd be making real money from the app anyway.
