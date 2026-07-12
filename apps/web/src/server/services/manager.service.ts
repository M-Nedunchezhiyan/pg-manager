// PG manager assignment — owner-only. A PG has at most one manager, but one
// manager may be assigned to several PGs (DB-enforced via a unique constraint
// on user_pg_scopes.pg_id only — see packages/db/prisma/schema.prisma).

import { randomBytes } from 'node:crypto';

import { Prisma, UserRole } from '@pg/db';
import argon2 from 'argon2';
import { z } from 'zod';

import { recordAudit } from '@/server/common/audit';
import { prisma } from '@/server/common/prisma';
import { assertOwner } from '@/server/common/scope';
import { HttpError } from '@/server/common/session';

export const AssignManagerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
});
export type AssignManagerInput = z.infer<typeof AssignManagerSchema>;

export interface PgManagerSummary {
  id: string;
  name: string;
  email: string;
}

function generateTempPassword(): string {
  // 9 random bytes (72 bits) base64url-encoded — 12 chars, well past the 8-char minimum.
  return randomBytes(9).toString('base64url');
}

export async function getPgManager(pgId: string, role: UserRole): Promise<PgManagerSummary | null> {
  assertOwner(role);
  // findFirst, not findUnique: Prisma's generated WhereUniqueInput for
  // UserPGScope only exposes the compound `userId_pgId` key, even though
  // pgId/userId each carry their own @@unique constraint at the DB level.
  const scope = await prisma.userPGScope.findFirst({
    where: { pgId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  return scope?.user ?? null;
}

export async function assignPgManager(
  pgId: string,
  input: AssignManagerInput,
  ownerUserId: string,
  role: UserRole,
): Promise<PgManagerSummary & { temporaryPassword: string | null }> {
  assertOwner(role);

  const pg = await prisma.pG.findUnique({ where: { id: pgId }, select: { id: true } });
  if (!pg) throw new HttpError(404, 'PG not found');

  if (await prisma.userPGScope.findFirst({ where: { pgId } })) {
    throw new HttpError(409, 'This PG already has a manager. Remove them first.');
  }

  const email = input.email.toLowerCase().trim();
  const existingUser = await prisma.user.findUnique({ where: { email } });

  let managerId: string;
  let managerName: string;
  let temporaryPassword: string | null = null;

  if (existingUser) {
    if (existingUser.role !== UserRole.MANAGER) {
      throw new HttpError(409, 'This email belongs to a non-manager account.');
    }
    // A manager may be scoped to more than one PG — just link them to this one too.
    managerId = existingUser.id;
    managerName = existingUser.name;
  } else {
    temporaryPassword = generateTempPassword();
    const passwordHash = await argon2.hash(temporaryPassword, { type: argon2.argon2id });
    try {
      const user = await prisma.user.create({
        data: { email, name: input.name, passwordHash, role: UserRole.MANAGER },
      });
      managerId = user.id;
      managerName = user.name;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new HttpError(409, 'A user with this email already exists.');
      }
      throw err;
    }
  }

  try {
    await prisma.userPGScope.create({ data: { userId: managerId, pgId } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(409, 'This PG or this manager already has a conflicting assignment.');
    }
    throw err;
  }

  await recordAudit({
    userId: ownerUserId,
    action: 'pg.manager.assign',
    entity: 'pg',
    entityId: pgId,
    pgId,
    after: { managerId, managerEmail: email },
  });

  return { id: managerId, name: managerName, email, temporaryPassword };
}

export async function removePgManager(pgId: string, ownerUserId: string, role: UserRole): Promise<void> {
  assertOwner(role);

  const scope = await prisma.userPGScope.findFirst({ where: { pgId } });
  if (!scope) throw new HttpError(404, 'No manager assigned to this PG');

  await prisma.userPGScope.delete({ where: { userId_pgId: { userId: scope.userId, pgId } } });

  await recordAudit({
    userId: ownerUserId,
    action: 'pg.manager.remove',
    entity: 'pg',
    entityId: pgId,
    pgId,
    before: { managerId: scope.userId },
  });
}
