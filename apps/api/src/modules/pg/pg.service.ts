import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@pg/db';

import { PrismaService } from '../prisma/prisma.service';
import type { CreatePgInput, PgSettingsInput, UpdatePgInput } from './pg.dto';

@Injectable()
export class PgService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, role: UserRole) {
    const where = role === UserRole.OWNER ? {} : { scopedUsers: { some: { userId } } };
    return this.prisma.pG.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        settings: true,
        _count: { select: { residents: { where: { status: 'ACTIVE' } } } },
      },
    });
  }

  async get(pgId: string, userId: string, role: UserRole) {
    await this.assertScope(pgId, userId, role);
    const pg = await this.prisma.pG.findUnique({
      where: { id: pgId },
      include: {
        settings: true,
        floors: { orderBy: { number: 'asc' } },
        sharingTypes: true,
      },
    });
    if (!pg) throw new NotFoundException();
    return pg;
  }

  async create(input: CreatePgInput, ownerUserId: string) {
    return this.prisma.pG.create({
      data: {
        ...input,
        settings: { create: { advanceMonths: 2, dueDaysAfterJoin: 3, lateFeePerDay: 0, noticeDays: 30 } },
      },
      include: { settings: true },
    });
  }

  async update(pgId: string, input: UpdatePgInput, userId: string, role: UserRole) {
    await this.assertScope(pgId, userId, role);
    return this.prisma.pG.update({ where: { id: pgId }, data: input });
  }

  async updateSettings(pgId: string, input: PgSettingsInput, userId: string, role: UserRole) {
    await this.assertScope(pgId, userId, role);
    return this.prisma.pGSettings.upsert({
      where: { pgId },
      create: { pgId, ...input },
      update: input,
    });
  }

  async remove(pgId: string, role: UserRole) {
    if (role !== UserRole.OWNER) throw new ForbiddenException('Only owner can delete PG');
    // Soft delete — preserve history. Active flag flips, no rows removed.
    return this.prisma.pG.update({ where: { id: pgId }, data: { isActive: false } });
  }

  private async assertScope(pgId: string, userId: string, role: UserRole): Promise<void> {
    if (role === UserRole.OWNER) return;
    const scope = await this.prisma.userPGScope.findUnique({
      where: { userId_pgId: { userId, pgId } },
    });
    if (!scope) throw new ForbiddenException('No access to this PG');
  }
}
