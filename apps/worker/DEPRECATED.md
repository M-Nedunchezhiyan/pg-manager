# Deprecated — apps/worker

This BullMQ-based worker has been replaced by Vercel Cron + Next.js Route Handlers
under `apps/web/src/app/api/cron/`. The migration is documented in `/MIGRATION.md`.

**What lived here:**
- `rent-due.scan.ts` — daily scan for residents whose rent is due today/tomorrow.

**Where it lives now:**
- `apps/web/src/app/api/cron/rent-due-scan/route.ts` — same logic, called daily by Vercel Cron.
- `apps/web/src/app/api/cron/keepalive/route.ts` — pings Supabase every 4 h to prevent project pausing.

**Safe to delete:** once the cron has been verified on Vercel for a couple of cycles,
this whole directory can be removed in one commit.

**Don't deploy this anywhere.** Redis is no longer part of the stack.
