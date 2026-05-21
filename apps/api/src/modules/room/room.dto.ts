import { z } from 'zod';

export const CreateRoomSchema = z.object({
  floorId: z.string().cuid(),
  sharingTypeId: z.string().cuid(),
  number: z.string().min(1).max(20),
  rentOverride: z.number().int().min(0).optional(),
});
export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;

export const UpdateRoomSchema = z.object({
  number: z.string().min(1).max(20).optional(),
  sharingTypeId: z.string().cuid().optional(),
  rentOverride: z.number().int().min(0).nullable().optional(),
});
export type UpdateRoomInput = z.infer<typeof UpdateRoomSchema>;
