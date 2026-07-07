// Ported from apps/api/src/modules/room and apps/api/src/modules/bed.
// Framework-agnostic: takes prisma + audit by import, no DI container.

import { BedStatus, Prisma, UserRole } from '@pg/db';
import { z } from 'zod';

import { prisma } from '@/server/common/prisma';
import { assertPgScope } from '@/server/common/scope';
import { HttpError } from '@/server/common/session';

// ── Rooms ────────────────────────────────────────────────────────────────

export const CreateRoomSchema = z.object({
  floorId: z.string().cuid(),
  sharingTypeId: z.string().cuid(),
  number: z.string().min(1).max(20),
  rentOverride: z.number().int().min(0).optional(),
});
export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;

export const UpdateRoomSchema = z.object({
  number: z.string().min(1).max(20).optional(),
  sharingTypeId: z.string().cuid().optional(),
  rentOverride: z.number().int().min(0).nullable().optional(),
});
export type UpdateRoomInput = z.infer<typeof UpdateRoomSchema>;

export async function listRoomsByPg(pgId: string, userId: string, role: UserRole) {
  await assertPgScope(pgId, userId, role);
  return prisma.room.findMany({
    where: { floor: { pgId } },
    orderBy: [{ floor: { number: 'asc' } }, { number: 'asc' }],
    include: {
      floor: true,
      sharingType: true,
      beds: { orderBy: { label: 'asc' } },
    },
  });
}

export async function createRoom(input: CreateRoomInput, userId: string, role: UserRole) {
  const floor = await prisma.floor.findUnique({ where: { id: input.floorId } });
  if (!floor) throw new HttpError(404, 'Floor not found');
  await assertPgScope(floor.pgId, userId, role);

  const sharing = await prisma.sharingType.findUnique({ where: { id: input.sharingTypeId } });
  if (!sharing || sharing.pgId !== floor.pgId) {
    throw new HttpError(400, 'Sharing type belongs to a different PG');
  }

  // Bed labels: A, B, C... up to sharing.capacity. Created atomically with the room.
  const bedLabels = Array.from({ length: sharing.capacity }, (_, i) => String.fromCharCode(65 + i));

  try {
    return await prisma.room.create({
      data: {
        floorId: input.floorId,
        sharingTypeId: input.sharingTypeId,
        number: input.number,
        rentOverride: input.rentOverride,
        beds: { create: bedLabels.map((label) => ({ label, status: BedStatus.VACANT })) },
      },
      include: { beds: true, sharingType: true },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new HttpError(409, `Room ${input.number} already exists on this floor`);
    }
    throw e;
  }
}

export async function updateRoom(
  roomId: string,
  input: UpdateRoomInput,
  userId: string,
  role: UserRole,
) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { floor: true, beds: { include: { allocations: { where: { toDate: null } } } } },
  });
  if (!room) throw new HttpError(404, 'Room not found');
  await assertPgScope(room.floor.pgId, userId, role);

  // Block capacity changes if any bed is occupied.
  if (input.sharingTypeId && input.sharingTypeId !== room.sharingTypeId) {
    const occupied = room.beds.some((b) => b.allocations.length > 0);
    if (occupied) throw new HttpError(409, 'Cannot change sharing type while beds are occupied');
  }
  return prisma.room.update({ where: { id: roomId }, data: input });
}

export async function removeRoom(roomId: string, userId: string, role: UserRole) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { floor: true, beds: { include: { allocations: { where: { toDate: null } } } } },
  });
  if (!room) throw new HttpError(404, 'Room not found');
  await assertPgScope(room.floor.pgId, userId, role);
  const occupied = room.beds.some((b) => b.allocations.length > 0);
  if (occupied) throw new HttpError(409, 'Cannot delete room with occupied beds');
  return prisma.room.delete({ where: { id: roomId } });
}

// ── Beds ─────────────────────────────────────────────────────────────────

export const UpdateBedSchema = z.object({
  label: z.string().min(1).max(10).optional(),
  status: z.enum(['VACANT', 'OCCUPIED', 'BLOCKED', 'NOTICE_PERIOD']).optional(),
});
export type UpdateBedInput = z.infer<typeof UpdateBedSchema>;

/** Full bed map for a PG: floors → rooms → beds with current allocation. */
export async function getBedMap(pgId: string, userId: string, role: UserRole) {
  await assertPgScope(pgId, userId, role);
  return prisma.floor.findMany({
    where: { pgId },
    orderBy: { number: 'asc' },
    include: {
      rooms: {
        orderBy: { number: 'asc' },
        include: {
          sharingType: true,
          beds: {
            orderBy: { label: 'asc' },
            include: {
              allocations: {
                where: { toDate: null },
                include: {
                  resident: { select: { id: true, fullName: true, joinedOn: true } },
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function updateBed(
  bedId: string,
  input: UpdateBedInput,
  userId: string,
  role: UserRole,
) {
  const bed = await prisma.bed.findUnique({
    where: { id: bedId },
    include: {
      room: { include: { floor: true } },
      allocations: { where: { toDate: null } },
    },
  });
  if (!bed) throw new HttpError(404, 'Bed not found');
  await assertPgScope(bed.room.floor.pgId, userId, role);

  // Don't allow flipping an occupied bed to VACANT without ending the allocation.
  if (input.status === 'VACANT' && bed.allocations.length > 0) {
    throw new HttpError(400, 'Bed has an active allocation; end it before vacating');
  }
  if (input.status === 'BLOCKED' && bed.allocations.length > 0) {
    throw new HttpError(400, 'Bed is occupied; cannot block');
  }

  return prisma.bed.update({ where: { id: bedId }, data: input });
}
