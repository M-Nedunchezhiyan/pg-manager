# Neon Database — creating credentials & wiring them up

This project stores all relational data in **Postgres**, accessed through Prisma
(`packages/db`). For any hosted / live environment we use **[Neon](https://neon.tech)**
— serverless Postgres with a generous free tier, a built-in connection pooler,
and scale-to-zero.

This guide walks through creating a Neon project and getting the two connection
strings the app needs:

| Env var        | Neon endpoint            | Used by                                   |
| -------------- | ------------------------ | ----------------------------------------- |
| `DATABASE_URL` | **Pooled** (`-pooler`)   | The app at runtime (serverless-friendly). |
| `DIRECT_URL`   | **Direct** (no `-pooler`)| Prisma migrations only.                   |

Both are referenced in `packages/db/prisma/schema.prisma`.

---

## 1. Create a Neon account & project

1. Go to **https://neon.tech** and sign up (GitHub / Google / email — free, no card).
2. In the **Neon Console**, click **New Project**.
3. Fill in:
   - **Project name**: e.g. `pg-manager`.
   - **Postgres version**: latest (default is fine).
   - **Region**: pick the one closest to where your app runs (for Vercel, match
     your Vercel function region — e.g. `AWS US East (N. Virginia)`).
4. Click **Create project**.

Neon automatically creates:
- a database (default name `neondb`),
- a role/user (default `neondb_owner`),
- a password (shown **once** — see below).

## 2. Copy the connection strings

After the project is created, Neon shows a **Connect** dialog (you can re-open it
any time via **Dashboard → Connect** or the **Connection Details** widget).

1. In the connect dialog, make sure **Connection pooling** is **enabled** (toggle
   it on). The host will now contain `-pooler`. Copy this string — it becomes
   **`DATABASE_URL`**:

   ```
   postgresql://neondb_owner:<password>@ep-cool-name-12345-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```

2. Toggle **Connection pooling** **off** (or pick the "direct connection"
   option). The host loses the `-pooler` suffix. Copy this string — it becomes
   **`DIRECT_URL`**:

   ```
   postgresql://neondb_owner:<password>@ep-cool-name-12345.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```

> The two strings are **identical except for `-pooler` in the host**. The
> password is the same in both.

### Getting / resetting the password

The password is only displayed in full inside the connect dialog. If you didn't
copy it:

- **Dashboard → Roles** (under Settings/Branches) → select your role →
  **Reset password** → copy the new one.
- Then update `DATABASE_URL` and `DIRECT_URL` everywhere with the new password.

> If your password contains URL-special characters (`@`, `:`, `/`, `#`, `?`),
> URL-encode them — e.g. `@` → `%40`. Neon-generated passwords are usually
> URL-safe, so this is rarely needed.

## 3. Put the credentials in your env files

**Local development** — `apps/web/.env.local` (copy from `apps/web/.env.example`):

```bash
DATABASE_URL=postgresql://neondb_owner:<password>@ep-...-pooler.<region>.aws.neon.tech/neondb?sslmode=require
DIRECT_URL=postgresql://neondb_owner:<password>@ep-...<region>.aws.neon.tech/neondb?sslmode=require
```

**Production (Vercel)** — Project Settings → **Environment Variables**, add both
`DATABASE_URL` and `DIRECT_URL` for the **Production** (and **Preview**, if used)
environments. Redeploy after saving.

> Never commit real connection strings. `.env.local` is git-ignored; only
> `*.env.example` (placeholders) belongs in the repo.

## 4. Push the schema & verify

From the repo root, with the env vars set:

```bash
# Generate the Prisma client
pnpm --filter @pg/db prisma generate

# Confirm Prisma can read the config and reach Neon
pnpm --filter @pg/db prisma validate

# Create the tables on Neon. This repo has no migration history, so use db push
# (it diffs the schema straight onto the database — uses DIRECT_URL under the hood).
pnpm --filter @pg/db prisma db push

# Create your single login account (argon2-hashed password, stored in Neon)
SEED_OWNER_EMAIL=you@example.com \
SEED_OWNER_PASSWORD='a-strong-password' \
pnpm --filter @pg/db prisma db seed

# Optional: open a GUI against the live DB
pnpm --filter @pg/db prisma studio
```

> Prefer versioned migrations later? Run `pnpm --filter @pg/db prisma migrate dev
> --name init` once to generate a baseline, then use `migrate deploy` in CI.

A quick connectivity smoke test without Prisma Studio:

```bash
pnpm --filter @pg/db exec prisma db execute --stdin <<< 'SELECT 1;'
```

Or, once deployed, hit the keepalive endpoint which runs `SELECT 1` against the
DB (`apps/web/src/app/api/cron/keepalive/route.ts`).

---

## Notes & gotchas

- **Why two URLs?** Neon's pooler runs PgBouncer in transaction mode, which is
  perfect for many short serverless connections but cannot run schema migrations.
  Prisma uses `directUrl` for `migrate`/`db push` and `url` for everything else.
- **SSL is mandatory.** Keep `?sslmode=require`. Connections without TLS are
  rejected by Neon.
- **Scale-to-zero / cold starts.** On the free tier the compute suspends after
  inactivity; the first query afterwards pays a short cold-start. The 4-hourly
  `keepalive` cron (`vercel.json`) keeps it warm.
- **Branching.** Neon can create instant DB branches (e.g. one per Vercel preview
  deploy). Each branch has its own connection string — copy it the same way.
- **Connection limits.** If you see "too many connections", ensure the app uses
  the **pooled** `DATABASE_URL`. You can also append `&connection_limit=1` to
  `DATABASE_URL` for serverless.
- **Optional — Neon serverless driver.** For edge runtimes you can use
  `@neondatabase/serverless` + `@prisma/adapter-neon`. Not required here; the
  app runs on the Node.js runtime and the standard pooled TCP connection works.
