import { z } from 'zod';

export const PgTypeSchema = z.enum(['MALE', 'FEMALE', 'COED']);

export const CreatePgSchema = z.object({
  name: z.string().min(2).max(100),
  type: PgTypeSchema,
  address: z.string().min(5).max(500),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  pincode: z.string().regex(/^\d{6}$/),
  phone: z.string().regex(/^\+?\d{10,15}$/).optional(),
  imageUrl: z.string().url().optional(),
});
export type CreatePgInput = z.infer<typeof CreatePgSchema>;

export const UpdatePgSchema = CreatePgSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdatePgInput = z.infer<typeof UpdatePgSchema>;

export const PgSettingsSchema = z.object({
  advanceMonths: z.number().int().min(0).max(24),
  dueDaysAfterJoin: z.number().int().min(0).max(31),
  lateFeePerDay: z.number().int().min(0),
  noticeDays: z.number().int().min(0).max(180),
});
export type PgSettingsInput = z.infer<typeof PgSettingsSchema>;
