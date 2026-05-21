import { z } from 'zod';

export const CreateSharingTypeSchema = z.object({
  pgId: z.string().cuid(),
  name: z.string().min(1).max(50),
  capacity: z.number().int().min(1).max(20),
  monthlyRent: z.number().int().min(0), // paise
});
export type CreateSharingTypeInput = z.infer<typeof CreateSharingTypeSchema>;

export const UpdateSharingTypeSchema = CreateSharingTypeSchema.partial().omit({ pgId: true });
export type UpdateSharingTypeInput = z.infer<typeof UpdateSharingTypeSchema>;
