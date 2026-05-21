// Ported from apps/api/src/modules/pg/pg.service.ts.
// Framework-agnostic: takes prisma + audit by import, no DI container.

import { UserRole } from '@pg/db';
import { z } from 'zod';

import { recordAudit } from '@/server/common/audit';
import { prisma } from '@/server/common/prisma';
import { assertPgScope } from '@/server/common/scope';
import { HttpError } from '@/server/common/session';

export const CreatePgSchema = z.object({
  name: z.string().min(2).max(100),
  type: z.enum(['MALE', 'FEMALE', 'COED']),
  address: z.string().min(5).max(500),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  pincode: z.string().regex(/^\d{6}$/),
  phone: z.string().regex(/^\+?\d{10,15}$/).optional(),
  imageUrl: z.string().url().optional(),
});
export type CreatePgInput = z.infer<typeof CreatePgSchema>;

export const UpdatePgSchema = CreatePgSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdatePgInput = z.infer<typeof UpdatePgSchema>;

export const PgSettingsSchema = z.object({
  advanceMonths: z.number().int().min(0).max(24).optional(),
  dueDaysAfterJoin: z.number().int().min(0).max(31).optional(),
  lateFeePerDay: z.number().int().min(0).optional(),
  noticeDays: z.number().int().min(0).max(180).optional(),
});
export type PgSettingsInput = z.infer<typeof PgSettingsSchema>;

export async function listPGs(userId: string, role: UserRole) {
  const where = role === UserRole.OWNER ? {} : { scopedUsers: { some: { userId } } };
  return prisma.pG.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      settings: true,
      _count: { select: { residents: { where: { status: 'ACTIVE' } } } },
    },
  });
}

export async function getPG(pgId: string, userId: string, role: UserRole) {
  await assertPgScope(pgId, userId, role);
  const pg = await prisma.pG.findUnique({
    where: { id: pgId },
    include: {
      settings: true,
      floors: { orderBy: { number: 'asc' } },
      sharingTypes: true,
    },
  });
  if (!pg) throw new HttpError(404, 'PG not found');
  return pg;
}

export async function createPG(input: CreatePgInput, ownerUserId: string, role: UserRole) {
  if (role !== UserRole.OWNER) throw new HttpError(403, 'Only owners can create PGs');
  const pg = await prisma.pG.create({
    data: {
      ...input,
      settings: {
        create: { advanceMonths: 2, dueDaysAfterJoin: 3, lateFeePerDay: 0, noticeDays: 30 },
      },
    },
    include: { settings: true },
  });
  await recordAudit({
    userId: ownerUserId,
    action: 'pg.create',
    entity: 'pg',
    entityId: pg.id,
    pgId: pg.id,
    after: { name: pg.name },
  });
  return pg;
}

export async function updatePG(
  pgId: string,
  input: UpdatePgInput,
  userId: string,
  role: UserRole,
) {
  await assertPgScope(pgId, userId, role);
  return prisma.pG.update({ where: { id: pgId }, data: input });
}

export async function updatePgSettings(
  pgId: string,
  input: PgSettingsInput,
  userId: string,
  role: UserRole,
) {
  await assertPgScope(pgId, userId, role);
  return prisma.pGSettings.upsert({
    where: { pgId },
    create: { pgId, ...input },
    update: input,
  });
}

export async function removePG(pgId: string, userId: string, role: UserRole) {
  if (role !== UserRole.OWNER) throw new HttpError(403, 'Only owner can delete PG');
  // Soft delete — preserve history.
  await prisma.pG.update({ where: { id: pgId }, data: { isActive: false } });
  await recordAudit({
    userId,
    action: 'pg.delete',
    entity: 'pg',
    entityId: pgId,
    pgId,
  });
}
