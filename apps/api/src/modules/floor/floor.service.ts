import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@pg/db';

import { PrismaService } from '../prisma/prisma.service';
import type { CreateFloorInput, UpdateFloorInput } from './floor.dto';

@Injectable()
export class FloorService {
  constructor(private readonly prisma: PrismaService) {}

  async assertScope(pgId: string, userId: string, role: UserRole): Promise<void> {
    if (role === UserRole.OWNER) return;
    const scope = await this.prisma.userPGScope.findUnique({
      where: { userId_pgId: { userId, pgId } },
    });
    if (!scope) throw new ForbiddenException('No access to this PG');
  }

  async list(pgId: string) {
    return this.prisma.floor.findMany({
      where: { pgId },
      orderBy: { number: 'asc' },
      include: { _count: { select: { rooms: true } } },
    });
  }

  async create(input: CreateFloorInput, userId: string, role: UserRole) {
    await this.assertScope(input.pgId, userId, role);
    try {
      return await this.prisma.floor.create({ data: input });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Floor ${input.number} already exists in this PG`);
      }
      throw e;
    }
  }

  async update(floorId: string, input: UpdateFloorInput, userId: string, role: UserRole) {
    const floor = await this.prisma.floor.findUnique({ where: { id: floorId } });
    if (!floor) throw new NotFoundException();
    await this.assertScope(floor.pgId, userId, role);
    return this.prisma.floor.update({ where: { id: floorId }, data: input });
  }

  async remove(floorId: string, userId: string, role: UserRole) {
    const floor = await this.prisma.floor.findUnique({
      where: { id: floorId },
      include: { _count: { select: { rooms: true } } },
    });
    if (!floor) throw new NotFoundException();
    await this.assertScope(floor.pgId, userId, role);
    if (floor._count.rooms > 0) {
      throw new ConflictException('Floor has rooms; remove them first');
    }
    return this.prisma.floor.delete({ where: { id: floorId } });
  }
}
