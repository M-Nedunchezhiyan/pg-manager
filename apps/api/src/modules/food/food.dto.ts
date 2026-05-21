import { z } from 'zod';

export const CreateFoodItemSchema = z.object({
  name: z.string().min(1).max(100),
});
export type CreateFoodItemInput = z.infer<typeof CreateFoodItemSchema>;

export const CreateFoodGroupSchema = z.object({
  pgId: z.string().cuid(),
  name: z.string().min(1).max(100),
  mealType: z.enum(['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER']),
  itemIds: z.array(z.string().cuid()).min(1),
  isDefault: z.boolean().default(false),
});
export type CreateFoodGroupInput = z.infer<typeof CreateFoodGroupSchema>;

export const SetDailyMenuSchema = z.object({
  pgId: z.string().cuid(),
  date: z.string().date(),
  mealType: z.enum(['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER']),
  // Provide either groupId OR itemIds (or both for ad-hoc additions).
  groupId: z.string().cuid().nullable().optional(),
  itemIds: z.array(z.string().cuid()).optional(),
});
export type SetDailyMenuInput = z.infer<typeof SetDailyMenuSchema>;
