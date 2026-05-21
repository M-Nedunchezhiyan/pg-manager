// Centralized PG-scope check. OWNER bypasses; others must have a row in
// public.user_pg_scopes for the target PG.

import { UserRole } from '@pg/db';

import { prisma } from './prisma';
import { HttpError } from './session';

export async function assertPgScope(pgId: string, userId: string, role: UserRole): Promise<void> {
  if (role === UserRole.OWNER) return;
  const scope = await prisma.userPGScope.findUnique({
    where: { userId_pgId: { userId, pgId } },
  });
  if (!scope) throw new HttpError(403, 'No access to this PG');
}
