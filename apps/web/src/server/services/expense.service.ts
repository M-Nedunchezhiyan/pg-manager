// Ported from apps/api/src/modules/expense.
// Framework-agnostic: takes prisma + audit by import, no DI container.

import { UserRole } from '@pg/db';
import { z } from 'zod';

import { recordAudit } from '@/server/common/audit';
import { prisma } from '@/server/common/prisma';
import { assertPgScope } from '@/server/common/scope';
import { HttpError } from '@/server/common/session';

export const CreateExpenseSchema = z.object({
  pgId: z.string().cuid(),
  category: z.enum([
    'ELECTRICITY',
    'WATER',
    'GAS',
    'INTERNET',
    'SALARY',
    'GROCERY',
    'REPAIR',
    'MAINTENANCE',
    'RENT',
    'TAX',
    'OTHER',
  ]),
  amount: z.number().int().positive(), // paise
  spentOn: z.string().date(),
  note: z.string().max(1000).optional(),
  attachmentUrl: z.string().url().optional(),
});
export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>;

export async function listExpenses(
  pgId: string,
  userId: string,
  role: UserRole,
  opts: { from?: string; to?: string } = {},
) {
  await assertPgScope(pgId, userId, role);
  return prisma.expense.findMany({
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

export async function createExpense(
  input: CreateExpenseInput,
  userId: string,
  role: UserRole,
  meta: { ip?: string; userAgent?: string } = {},
) {
  await assertPgScope(input.pgId, userId, role);
  const e = await prisma.expense.create({
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
  await recordAudit({
    userId,
    action: 'expense.create',
    entity: 'expense',
    entityId: e.id,
    pgId: input.pgId,
    after: { category: e.category, amount: e.amount, spentOn: e.spentOn.toISOString() },
    ...meta,
  });
  return e;
}

export async function removeExpense(id: string, userId: string, role: UserRole) {
  const e = await prisma.expense.findUnique({ where: { id } });
  if (!e) throw new HttpError(404, 'Expense not found');
  await assertPgScope(e.pgId, userId, role);
  return prisma.expense.delete({ where: { id } });
}
