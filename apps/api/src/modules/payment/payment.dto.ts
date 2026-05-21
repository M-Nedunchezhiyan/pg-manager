import { z } from 'zod';

export const RecordPaymentSchema = z.object({
  residentId: z.string().cuid(),
  kind: z.enum(['RENT', 'ADVANCE', 'LATE_FEE', 'ADJUSTMENT']),
  forMonth: z.number().int().min(1).max(12).optional(),
  forYear: z.number().int().min(2020).max(2100).optional(),
  amount: z.number().int().positive(),
  lateFee: z.number().int().min(0).default(0),
  paidOn: z.string().date(),
  method: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'OTHER']),
  reference: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});
export type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>;
