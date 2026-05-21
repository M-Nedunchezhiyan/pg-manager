import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@pg/db';

import { PrismaService } from '../prisma/prisma.service';
import type { UpdateBedInput } from './bed.dto';

@Injectable()
export class BedService {
  constructor(private readonly prisma: PrismaService) {}

  async assertScope(pgId: string, userId: string, role: UserRole): Promise<void> {
    if (role === UserRole.OWNER) return;
    const scope = await this.prisma.userPGScope.findUnique({
      where: { userId_pgId: { userId, pgId } },
    });
    if (!scope) throw new ForbiddenException('No access to this PG');
  }

  /** Full bed map for a PG: floors → rooms → beds with current allocation. */
  async map(pgId: string) {
    return this.prisma.floor.findMany({
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

  async update(bedId: string, input: UpdateBedInput, userId: string, role: UserRole) {
    const bed = await this.prisma.bed.findUnique({
      where: { id: bedId },
      include: {
        room: { include: { floor: true } },
        allocations: { where: { toDate: null } },
      },
    });
    if (!bed) throw new NotFoundException();
    await this.assertScope(bed.room.floor.pgId, userId, role);

    // Don't allow flipping an occupied bed to VACANT without ending the allocation.
    if (input.status === 'VACANT' && bed.allocations.length > 0) {
      throw new BadRequestException('Bed has an active allocation; end it before vacating');
    }
    if (input.status === 'BLOCKED' && bed.allocations.length > 0) {
      throw new BadRequestException('Bed is occupied; cannot block');
    }

    return this.prisma.bed.update({ where: { id: bedId }, data: input });
  }
}
