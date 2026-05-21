import { z } from 'zod';

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
