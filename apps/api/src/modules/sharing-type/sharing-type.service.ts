import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@pg/db';

import { PrismaService } from '../prisma/prisma.service';
import type { CreateSharingTypeInput, UpdateSharingTypeInput } from './sharing-type.dto';

@Injectable()
export class SharingTypeService {
  constructor(private readonly prisma: PrismaService) {}

  async assertScope(pgId: string, userId: string, role: UserRole): Promise<void> {
    if (role === UserRole.OWNER) return;
    const scope = await this.prisma.userPGScope.findUnique({
      where: { userId_pgId: { userId, pgId } },
    });
    if (!scope) throw new ForbiddenException('No access to this PG');
  }

  list(pgId: string) {
    return this.prisma.sharingType.findMany({
      where: { pgId },
      orderBy: { capacity: 'asc' },
      include: { _count: { select: { rooms: true } } },
    });
  }

  async create(input: CreateSharingTypeInput, userId: string, role: UserRole) {
    await this.assertScope(input.pgId, userId, role);
    try {
      return await this.prisma.sharingType.create({ data: input });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Sharing type "${input.name}" already exists in this PG`);
      }
      throw e;
    }
  }

  async update(id: string, input: UpdateSharingTypeInput, userId: string, role: UserRole) {
    const existing = await this.prisma.sharingType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    await this.assertScope(existing.pgId, userId, role);
    return this.prisma.sharingType.update({ where: { id }, data: input });
  }

  async remove(id: string, userId: string, role: UserRole) {
    const existing = await this.prisma.sharingType.findUnique({
      where: { id },
      include: { _count: { select: { rooms: true } } },
    });
    if (!existing) throw new NotFoundException();
    await this.assertScope(existing.pgId, userId, role);
    if (existing._count.rooms > 0) {
      throw new ConflictException('Sharing type is in use by rooms');
    }
    return this.prisma.sharingType.delete({ where: { id } });
  }
}
