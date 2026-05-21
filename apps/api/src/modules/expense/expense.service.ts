import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@pg/db';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateExpenseInput } from './expense.dto';

@Injectable()
export class ExpenseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async assertScope(pgId: string, userId: string, role: UserRole): Promise<void> {
    if (role === UserRole.OWNER) return;
    const scope = await this.prisma.userPGScope.findUnique({
      where: { userId_pgId: { userId, pgId } },
    });
    if (!scope) throw new ForbiddenException('No access to this PG');
  }

  list(pgId: string, opts: { from?: string; to?: string }) {
    return this.prisma.expense.findMany({
      where: {
        pgId,
        ...(opts.from || opts.to
          ? {
              spentOn: {
                ...(opts.from && { gte: new Date(opts.from) }),
                ...(opts.to && { lte: new Date(opts.to) }),
              },
            }
          : {}),
      },
      orderBy: [{ spentOn: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });
  }

  async create(
    input: CreateExpenseInput,
    userId: string,
    role: UserRole,
    meta: { ip?: string; userAgent?: string } = {},
  ) {
    await this.assertScope(input.pgId, userId, role);
    const e = await this.prisma.expense.create({
      data: {
        pgId: input.pgId,
        category: input.category,
        amount: input.amount,
        spentOn: new Date(input.spentOn),
        note: input.note,
        attachmentUrl: input.attachmentUrl,
        recordedBy: userId,
      },
    });
    await this.audit.record({
      userId,
      action: 'expense.create',
      entity: 'expense',
      entityId: e.id,
      pgId: input.pgId,
      after: { category: e.category, amount: e.amount, spentOn: e.spentOn.toISOString() },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return e;
  }

  async remove(id: string, userId: string, role: UserRole) {
    const e = await this.prisma.expense.findUnique({ where: { id } });
    if (!e) throw new NotFoundException();
    await this.assertScope(e.pgId, userId, role);
    return this.prisma.expense.delete({ where: { id } });
  }
}
