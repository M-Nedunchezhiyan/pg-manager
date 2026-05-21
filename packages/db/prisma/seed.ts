/**
 * Seed — Supabase Auth edition.
 *
 * After migrating to Supabase, identity lives in `auth.users` (managed by
 * Supabase) and `public.users` is auto-populated by the on_auth_user_created
 * trigger (see migration `20260522_supabase_auth_sync/migration.sql`).
 *
 * So the first owner is created by:
 *   1. `pnpm dev`, open /signup, sign up with the desired email + password
 *   2. Click the confirmation link Supabase sends to that email
 *   3. Run this seed once to promote that user to OWNER:
 *        SEED_OWNER_EMAIL=you@example.com pnpm --filter @pg/db prisma db seed
 *
 * No password hashing happens here — Supabase Auth owns credentials.
 */

import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_OWNER_EMAIL;
  if (!email) {
    console.error('Set SEED_OWNER_EMAIL to the email of an existing Supabase user.');
    process.exit(1);
  }

  const updated = await prisma.user.updateMany({
    where: { email },
    data: { role: UserRole.OWNER, isActive: true },
  });

  if (updated.count === 0) {
    console.error(
      `No public.users row for ${email}. ` +
        `Sign up at /signup first, confirm your email, then re-run.`,
    );
    process.exit(1);
  }

  console.warn(`Promoted ${email} to OWNER (rows: ${updated.count}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
