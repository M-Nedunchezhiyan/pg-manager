import { z } from 'zod';

export const UpdateBedSchema = z.object({
  label: z.string().min(1).max(10).optional(),
  status: z.enum(['VACANT', 'OCCUPIED', 'BLOCKED', 'NOTICE_PERIOD']).optional(),
});
export type UpdateBedInput = z.infer<typeof UpdateBedSchema>;
