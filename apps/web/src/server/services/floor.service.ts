// Ported from apps/api/src/modules/floor and apps/api/src/modules/sharing-type.
// Framework-agnostic: takes prisma + audit by import, no DI container.

import { Prisma, UserRole } from '@pg/db';
import { z } from 'zod';

import { prisma } from '@/server/common/prisma';
import { assertPgScope } from '@/server/common/scope';
import { HttpError } from '@/server/common/session';

// ── Floors ───────────────────────────────────────────────────────────────

export const CreateFloorSchema = z.object({
  pgId: z.string().cuid(),
  number: z.number().int().min(0).max(50),
  name: z.string().max(100).optional(),
  allowedGender: z.enum(['MALE', 'FEMALE', 'ANY']).default('ANY'),
});
export type CreateFloorInput = z.infer<typeof CreateFloorSchema>;

export const UpdateFloorSchema = CreateFloorSchema.partial().omit({ pgId: true });
export type UpdateFloorInput = z.infer<typeof UpdateFloorSchema>;

export async function listFloors(pgId: string, userId: string, role: UserRole) {
  await assertPgScope(pgId, userId, role);
  return prisma.floor.findMany({
    where: { pgId },
    orderBy: { number: 'asc' },
    include: { _count: { select: { rooms: true } } },
  });
}

export async function createFloor(input: CreateFloorInput, userId: string, role: UserRole) {
  await assertPgScope(input.pgId, userId, role);
  try {
    return await prisma.floor.create({ data: input });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new HttpError(409, `Floor ${input.number} already exists in this PG`);
    }
    throw e;
  }
}

export async function updateFloor(
  floorId: string,
  input: UpdateFloorInput,
  userId: string,
  role: UserRole,
) {
  const floor = await prisma.floor.findUnique({ where: { id: floorId } });
  if (!floor) throw new HttpError(404, 'Floor not found');
  await assertPgScope(floor.pgId, userId, role);
  return prisma.floor.update({ where: { id: floorId }, data: input });
}

export async function removeFloor(floorId: string, userId: string, role: UserRole) {
  const floor = await prisma.floor.findUnique({
    where: { id: floorId },
    include: { _count: { select: { rooms: true } } },
  });
  if (!floor) throw new HttpError(404, 'Floor not found');
  await assertPgScope(floor.pgId, userId, role);
  if (floor._count.rooms > 0) {
    throw new HttpError(409, 'Floor has rooms; remove them first');
  }
  return prisma.floor.delete({ where: { id: floorId } });
}

// ── Sharing types ────────────────────────────────────────────────────────

export const CreateSharingTypeSchema = z.object({
  pgId: z.string().cuid(),
  name: z.string().min(1).max(50),
  capacity: z.number().int().min(1).max(20),
  monthlyRent: z.number().int().min(0), // paise
});
export type CreateSharingTypeInput = z.infer<typeof CreateSharingTypeSchema>;

export const UpdateSharingTypeSchema = CreateSharingTypeSchema.partial().omit({ pgId: true });
export type UpdateSharingTypeInput = z.infer<typeof UpdateSharingTypeSchema>;

export async function listSharingTypes(pgId: string, userId: string, role: UserRole) {
  await assertPgScope(pgId, userId, role);
  return prisma.sharingType.findMany({
    where: { pgId },
    orderBy: { capacity: 'asc' },
    include: { _count: { select: { rooms: true } } },
  });
}

export async function createSharingType(
  input: CreateSharingTypeInput,
  userId: string,
  role: UserRole,
) {
  await assertPgScope(input.pgId, userId, role);
  try {
    return await prisma.sharingType.create({ data: input });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new HttpError(409, `Sharing type "${input.name}" already exists in this PG`);
    }
    throw e;
  }
}

export async function updateSharingType(
  id: string,
  input: UpdateSharingTypeInput,
  userId: string,
  role: UserRole,
) {
  const existing = await prisma.sharingType.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Sharing type not found');
  await assertPgScope(existing.pgId, userId, role);
  return prisma.sharingType.update({ where: { id }, data: input });
}

export async function removeSharingType(id: string, userId: string, role: UserRole) {
  const existing = await prisma.sharingType.findUnique({
    where: { id },
    include: { _count: { select: { rooms: true } } },
  });
  if (!existing) throw new HttpError(404, 'Sharing type not found');
  await assertPgScope(existing.pgId, userId, role);
  if (existing._count.rooms > 0) {
    throw new HttpError(409, 'Sharing type is in use by rooms');
  }
  return prisma.sharingType.delete({ where: { id } });
}
