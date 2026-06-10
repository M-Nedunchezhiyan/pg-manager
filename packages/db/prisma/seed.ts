/**
 * Seed — self-hosted auth edition.
 *
 * Creates (or updates) the single OWNER account directly in the database, with
 * the password hashed using argon2id. There's no signup flow — this is how you
 * provision the one account you log in with.
 *
 * Run:
 *   SEED_OWNER_EMAIL=you@example.com \
 *   SEED_OWNER_PASSWORD='a-strong-password' \
 *   pnpm --filter @pg/db prisma db seed
 *
 * Re-running with a new password resets it (idempotent upsert by email).
 */

import argon2 from 'argon2';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_OWNER_EMAIL?.toLowerCase().trim();
  const password = process.env.SEED_OWNER_PASSWORD;

  if (!email || !password) {
    console.error('Set SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD before seeding.');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('SEED_OWNER_PASSWORD must be at least 8 characters.');
    process.exit(1);
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const user = await prisma.user.upsert({
    where: { email },
    update: { role: UserRole.OWNER, isActive: true, passwordHash },
    create: {
      email,
      name: email.split('@')[0],
      role: UserRole.OWNER,
      isActive: true,
      passwordHash,
    },
  });

  console.warn(`Owner account ready: ${user.email} (role: ${user.role}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
