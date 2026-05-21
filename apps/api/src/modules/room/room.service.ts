import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BedStatus, Prisma, UserRole } from '@pg/db';

import { PrismaService } from '../prisma/prisma.service';
import type { CreateRoomInput, UpdateRoomInput } from './room.dto';

@Injectable()
export class RoomService {
  constructor(private readonly prisma: PrismaService) {}

  async assertScope(pgId: string, userId: string, role: UserRole): Promise<void> {
    if (role === UserRole.OWNER) return;
    const scope = await this.prisma.userPGScope.findUnique({
      where: { userId_pgId: { userId, pgId } },
    });
    if (!scope) throw new ForbiddenException('No access to this PG');
  }

  async listByFloor(floorId: string) {
    return this.prisma.room.findMany({
      where: { floorId },
      orderBy: { number: 'asc' },
      include: {
        floor: { select: { pgId: true } },
        sharingType: true,
        beds: {
          orderBy: { label: 'asc' },
          include: {
            allocations: {
              where: { toDate: null },
              include: { resident: { select: { id: true, fullName: true } } },
            },
          },
        },
      },
    });
  }

  async listByPg(pgId: string) {
    return this.prisma.room.findMany({
      where: { floor: { pgId } },
      orderBy: [{ floor: { number: 'asc' } }, { number: 'asc' }],
      include: {
        floor: true,
        sharingType: true,
        beds: { orderBy: { label: 'asc' } },
      },
    });
  }

  async create(input: CreateRoomInput, userId: string, role: UserRole) {
    const floor = await this.prisma.floor.findUnique({
      where: { id: input.floorId },
      include: { pg: true },
    });
    if (!floor) throw new NotFoundException('Floor not found');
    await this.assertScope(floor.pgId, userId, role);

    const sharing = await this.prisma.sharingType.findUnique({
      where: { id: input.sharingTypeId },
    });
    if (!sharing || sharing.pgId !== floor.pgId) {
      throw new BadRequestException('Sharing type belongs to a different PG');
    }

    // Bed labels: A, B, C... up to sharing.capacity. Created atomically with the room.
    const bedLabels = Array.from({ length: sharing.capacity }, (_, i) => String.fromCharCode(65 + i));

    try {
      return await this.prisma.room.create({
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
        throw new ConflictException(`Room ${input.number} already exists on this floor`);
      }
      throw e;
    }
  }

  async update(roomId: string, input: UpdateRoomInput, userId: string, role: UserRole) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { floor: true, beds: { include: { allocations: { where: { toDate: null } } } } },
    });
    if (!room) throw new NotFoundException();
    await this.assertScope(room.floor.pgId, userId, role);

    // Block capacity changes if any bed is occupied.
    if (input.sharingTypeId && input.sharingTypeId !== room.sharingTypeId) {
      const occupied = room.beds.some((b) => b.allocations.length > 0);
      if (occupied) throw new ConflictException('Cannot change sharing type while beds are occupied');
    }
    return this.prisma.room.update({ where: { id: roomId }, data: input });
  }

  async remove(roomId: string, userId: string, role: UserRole) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { floor: true, beds: { include: { allocations: { where: { toDate: null } } } } },
    });
    if (!room) throw new NotFoundException();
    await this.assertScope(room.floor.pgId, userId, role);
    const occupied = room.beds.some((b) => b.allocations.length > 0);
    if (occupied) throw new ConflictException('Cannot delete room with occupied beds');
    return this.prisma.room.delete({ where: { id: roomId } });
  }
}
