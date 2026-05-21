import { z } from 'zod';

export const CreateFloorSchema = z.object({
  pgId: z.string().cuid(),
  number: z.number().int().min(0).max(50),
  name: z.string().max(100).optional(),
  allowedGender: z.enum(['MALE', 'FEMALE', 'ANY']).default('ANY'),
});
export type CreateFloorInput = z.infer<typeof CreateFloorSchema>;

export const UpdateFloorSchema = CreateFloorSchema.partial().omit({ pgId: true });
export type UpdateFloorInput = z.infer<typeof UpdateFloorSchema>;
