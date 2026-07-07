// Ported from apps/api/src/modules/food.
// Framework-agnostic: takes prisma + audit by import, no DI container.

import { MealType, Prisma, UserRole } from '@pg/db';
import { z } from 'zod';

import { prisma } from '@/server/common/prisma';
import { assertPgScope } from '@/server/common/scope';
import { HttpError } from '@/server/common/session';

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

// ── Items master (global) ───────────────────────────────────────────────

export function listFoodItems() {
  return prisma.foodItem.findMany({ orderBy: { name: 'asc' } });
}

export async function createFoodItem(input: CreateFoodItemInput) {
  try {
    return await prisma.foodItem.create({ data: { name: input.name.trim() } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new HttpError(409, 'Item already exists');
    }
    throw e;
  }
}

export async function deleteFoodItem(id: string) {
  try {
    return await prisma.foodItem.delete({ where: { id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      throw new HttpError(409, 'Item is in use in a group or daily menu');
    }
    throw e;
  }
}

// ── Groups (per PG, per meal) ────────────────────────────────────────────

export async function listFoodGroups(pgId: string, userId: string, role: UserRole) {
  await assertPgScope(pgId, userId, role);
  return prisma.foodGroup.findMany({
    where: { pgId },
    orderBy: [{ mealType: 'asc' }, { name: 'asc' }],
    include: { items: { include: { item: true }, orderBy: { sortOrder: 'asc' } } },
  });
}

export async function createFoodGroup(
  input: CreateFoodGroupInput,
  userId: string,
  role: UserRole,
) {
  await assertPgScope(input.pgId, userId, role);

  try {
    return await prisma.$transaction(async (tx) => {
      // If this is the new default, demote previous defaults for the same meal.
      if (input.isDefault) {
        await tx.foodGroup.updateMany({
          where: { pgId: input.pgId, mealType: input.mealType, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.foodGroup.create({
        data: {
          pgId: input.pgId,
          name: input.name.trim(),
          mealType: input.mealType,
          isDefault: input.isDefault,
          items: {
            create: input.itemIds.map((itemId, i) => ({ itemId, sortOrder: i })),
          },
        },
        include: { items: { include: { item: true }, orderBy: { sortOrder: 'asc' } } },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new HttpError(409, 'A group with that name already exists for this meal');
    }
    throw e;
  }
}

export async function setFoodGroupDefault(groupId: string, userId: string, role: UserRole) {
  const group = await prisma.foodGroup.findUnique({ where: { id: groupId } });
  if (!group) throw new HttpError(404, 'Group not found');
  await assertPgScope(group.pgId, userId, role);
  return prisma.$transaction(async (tx) => {
    await tx.foodGroup.updateMany({
      where: { pgId: group.pgId, mealType: group.mealType, isDefault: true },
      data: { isDefault: false },
    });
    return tx.foodGroup.update({ where: { id: groupId }, data: { isDefault: true } });
  });
}

export async function deleteFoodGroup(groupId: string, userId: string, role: UserRole) {
  const group = await prisma.foodGroup.findUnique({ where: { id: groupId } });
  if (!group) throw new HttpError(404, 'Group not found');
  await assertPgScope(group.pgId, userId, role);
  return prisma.foodGroup.delete({ where: { id: groupId } });
}

// ── Daily menu ───────────────────────────────────────────────────────────

/** All menus for a date range. Defaults to a single day. */
export async function listDailyMenus(
  pgId: string,
  userId: string,
  role: UserRole,
  from?: string,
  to?: string,
) {
  await assertPgScope(pgId, userId, role);
  const fromDate = from ? new Date(from) : new Date();
  const toDate = to ? new Date(to) : fromDate;
  return prisma.dailyMenu.findMany({
    where: { pgId, date: { gte: fromDate, lte: toDate } },
    orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
    include: {
      group: { include: { items: { include: { item: true }, orderBy: { sortOrder: 'asc' } } } },
      items: { include: { item: true } },
    },
  });
}

/** Upsert the menu for (pgId, date, mealType). Replaces any prior items. */
export async function setDailyMenu(input: SetDailyMenuInput, userId: string, role: UserRole) {
  await assertPgScope(input.pgId, userId, role);

  if (!input.groupId && (!input.itemIds || input.itemIds.length === 0)) {
    throw new HttpError(400, 'Provide groupId or itemIds');
  }

  const date = new Date(input.date);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.dailyMenu.findUnique({
      where: { pgId_date_mealType: { pgId: input.pgId, date, mealType: input.mealType } },
    });
    const menu = existing
      ? await tx.dailyMenu.update({
          where: { id: existing.id },
          data: { groupId: input.groupId ?? null },
        })
      : await tx.dailyMenu.create({
          data: {
            pgId: input.pgId,
            date,
            mealType: input.mealType,
            groupId: input.groupId ?? null,
          },
        });

    // Replace items entirely.
    await tx.dailyMenuItem.deleteMany({ where: { menuId: menu.id } });
    if (input.itemIds && input.itemIds.length > 0) {
      await tx.dailyMenuItem.createMany({
        data: input.itemIds.map((itemId) => ({ menuId: menu.id, itemId })),
      });
    }
    return tx.dailyMenu.findUniqueOrThrow({
      where: { id: menu.id },
      include: {
        group: { include: { items: { include: { item: true }, orderBy: { sortOrder: 'asc' } } } },
        items: { include: { item: true } },
      },
    });
  });
}

/** Convenience: for a PG, pre-fill today's menus from default groups (no overwrite). */
export async function applyDefaultsForDate(
  pgId: string,
  date: string,
  userId: string,
  role: UserRole,
) {
  await assertPgScope(pgId, userId, role);
  const target = new Date(date);
  const defaults = await prisma.foodGroup.findMany({ where: { pgId, isDefault: true } });
  const meals: MealType[] = ['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER'];
  const created: string[] = [];
  for (const meal of meals) {
    const def = defaults.find((g) => g.mealType === meal);
    if (!def) continue;
    const existing = await prisma.dailyMenu.findUnique({
      where: { pgId_date_mealType: { pgId, date: target, mealType: meal } },
    });
    if (existing) continue;
    const m = await prisma.dailyMenu.create({
      data: { pgId, date: target, mealType: meal, groupId: def.id },
    });
    created.push(m.id);
  }
  return { applied: created.length };
}
