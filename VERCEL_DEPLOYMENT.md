# Deploying to Vercel — step by step

This is the guide for deploying **today's** stack: Next.js 16 on Vercel, **Neon**
Postgres, self-hosted email+password auth (argon2id + signed JWT cookie, no
external auth provider), and **Supabase Storage only** (for file uploads — not
auth, not the database).

> `MIGRATION.md` documents an earlier plan (Supabase for both DB and auth) that
> was later revised — Postgres moved to Neon and auth stayed self-hosted, with
> Supabase kept only for Storage. This doc reflects what's actually in the repo
> now; use it for a fresh deploy.

---

## 0. Prerequisites

| Account | Why | Sign up |
|---|---|---|
| **GitHub** | Hosts the repo, connects to Vercel | https://github.com/signup |
| **Vercel** | Runs the app + Route Handlers + Cron | https://vercel.com — sign in with GitHub |
| **Neon** | Serverless Postgres | https://neon.tech — sign in with GitHub |
| **Supabase** *(optional)* | Object storage for resident photos/ID uploads only | https://supabase.com |

Local tools: `node ≥22`, `pnpm` (via `corepack enable pnpm`), `git`.

---

## 1. Create the Neon database

Full walkthrough: [`NEON_SETUP.md`](./NEON_SETUP.md). Short version:

1. Create a Neon project.
2. From the **Connect** dialog, copy **two** connection strings:
   - Pooled (host has `-pooler`) → this becomes `DATABASE_URL`.
   - Direct (no `-pooler`) → this becomes `DIRECT_URL`.

Keep both handy — you'll need them locally and on Vercel.

---

## 2. (Optional) Create the Supabase Storage bucket

Only needed if residents will have photo/ID uploads. Skip this section if not — the app runs fine without it, uploads just won't work.

1. https://supabase.com/dashboard → **New project** → any region/name, **Free** plan.
2. Left nav → **Storage** → **New bucket** → name `pg-uploads` → **Public bucket: OFF** (the app uses short-lived signed URLs, not public access).
3. Left nav → **Project Settings → API** → copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (server-only — never expose to the browser, never prefix with `NEXT_PUBLIC_`)

---

## 3. Generate the app's secrets

Run these locally and save the output — each is used in step 6:

```bash
# AUTH_SECRET — signs the session JWT. Must stay stable across deploys
# (rotating it logs everyone out) and be the same in every environment.
openssl rand -base64 48

# PII_ENCRYPTION_KEY — AES-256-GCM key for resident PII at rest.
# Must be exactly 64 hex chars, and the SAME value forever — losing it
# means losing the ability to decrypt existing resident phone numbers etc.
openssl rand -hex 32

# CRON_SECRET — Vercel sends this as a Bearer token when it invokes
# /api/cron/*; it's how those endpoints reject non-Vercel callers.
openssl rand -base64 32
```

---

## 4. Push the repo to GitHub

```bash
cd pg-manager
git add .
git commit -m "Initial deploy"
gh repo create pg-manager --private --source=. --remote=origin --push
# or: create the repo on github.com, then
#   git remote add origin git@github.com:<you>/pg-manager.git
#   git branch -M main && git push -u origin main
```

---

## 5. Create the Vercel project

1. https://vercel.com/new → **Import Git Repository** → pick `pg-manager`.
2. **Configure Project**:
   - **Root Directory**: leave as the **repository root** (do *not* set it to `apps/web`) — `vercel.json` lives at the repo root and defines the real build/install/output commands and the cron schedule; if Root Directory pointed at `apps/web` instead, Vercel would never see that file and the crons would silently not register.
   - **Framework Preset**: Next.js (auto-detected).
   - **Build / Install / Output Commands**: leave on "Override" using the repo's `vercel.json` — it already sets:
     ```json
     "buildCommand": "pnpm --filter @pg/db db:generate && pnpm --filter @pg/web build"
     "installCommand": "pnpm install --frozen-lockfile"
     "outputDirectory": "apps/web/.next"
     ```
3. **Environment Variables**: skip for now — added in step 6.
4. Click **Deploy**. This first build will fail (no env vars yet) — expected.
5. **Settings → General → Node.js Version**: set **22.x** (matches `package.json`'s `engines.node`).

---

## 6. Set environment variables

Vercel project → **Settings → Environment Variables**. Add for **Production**
(and **Preview**, if you use preview deployments):

| Variable | Value | Required? |
|---|---|---|
| `AUTH_SECRET` | from step 3 | **Required** |
| `PII_ENCRYPTION_KEY` | from step 3 | **Required** |
| `CRON_SECRET` | from step 3 | **Required** — protects `/api/cron/*` |
| `DATABASE_URL` | Neon pooled connection string | **Required** |
| `DIRECT_URL` | Neon direct connection string | **Required** (Prisma schema push only) |
| `NEXT_PUBLIC_SUPABASE_URL` | from step 2 | Optional — only if using uploads |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from step 2 | Optional — only if using uploads |
| `SUPABASE_SERVICE_ROLE_KEY` | from step 2 | Optional — only if using uploads |
| `NEXT_PUBLIC_APP_URL` | your `https://<project>.vercel.app` URL | Present in `.env.example` but not currently read by any code — safe to set for future use, safe to skip |

After saving, **Deployments → latest → ⋯ → Redeploy** (env var changes don't apply to already-built deployments).

---

## 7. Push the schema and create your login

This repo has no `prisma/migrations/` history — schema changes are applied with
`prisma db push`, run from your local machine against the **production** Neon
credentials (there's no CI/automatic migration step; you do this manually and
deliberately, same as any other schema change):

```bash
cd packages/db
DATABASE_URL='<paste prod pooled URL>' \
DIRECT_URL='<paste prod direct URL>' \
pnpm prisma db push

# Create your one login account (self-hosted auth — no public signup exists)
DATABASE_URL='<paste prod pooled URL>' \
DIRECT_URL='<paste prod direct URL>' \
SEED_OWNER_EMAIL=you@example.com \
SEED_OWNER_PASSWORD='a-strong-password' \
pnpm prisma db seed
```

`db push` will warn about "possible data loss" for constraint changes even
when none is possible (e.g. on a brand-new empty table) — read what it's
actually warning about before passing `--accept-data-loss`; don't pass it
reflexively.

---

## 8. Deploy and smoke test

Push to `main` (or hit Redeploy) and wait for a green build, then:

1. Open `https://<your>.vercel.app/login` — should load with the ocean-blue theme.
2. Sign in with the `SEED_OWNER_EMAIL`/`SEED_OWNER_PASSWORD` from step 7.
3. Click **Add PG**, create one. Confirm it appears on the home page.
4. Open the PG → **Manager** card → **Assign manager** → create one with a
   test email. Copy the one-time generated password shown.
5. In an incognito window, log in as that manager. Confirm they land on that
   one PG only, and that hitting a different PG's URL/API 403s.
6. Hit `https://<your>.vercel.app/api/cron/keepalive` directly with
   `Authorization: Bearer <CRON_SECRET>` — should return 200, confirming the
   cron path can reach the DB.

---

## Cron on the Hobby plan — one caveat

`vercel.json` schedules `keepalive` every 4 hours to stop Neon's free tier from
scale-to-zero-pausing after inactivity. Vercel's Hobby plan has historically
restricted cron *frequency* (at times limited to once/day per job) — if the
4-hourly schedule doesn't fire as configured, check your plan's current cron
limits in the Vercel dashboard (**Settings → Cron Jobs**) and either upgrade to
Pro or accept a daily ping (Neon's free-tier pause window is measured in days,
so a daily hit is usually still enough to prevent it — just double-check
against Neon's current auto-suspend timeout).

---

## Rollback

Nothing here is destructive to roll back: revert the git commit and redeploy,
or use Vercel's **Deployments** list to instantly promote a previous
deployment. The database schema itself only ever grows via additive
`db push` changes in this repo's history — there's no automatic migration to
undo.
