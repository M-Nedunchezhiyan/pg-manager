import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MealType, Prisma, UserRole } from '@pg/db';

import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateFoodGroupInput,
  CreateFoodItemInput,
  SetDailyMenuInput,
} from './food.dto';

@Injectable()
export class FoodService {
  constructor(private readonly prisma: PrismaService) {}

  async assertScope(pgId: string, userId: string, role: UserRole): Promise<void> {
    if (role === UserRole.OWNER) return;
    const scope = await this.prisma.userPGScope.findUnique({
      where: { userId_pgId: { userId, pgId } },
    });
    if (!scope) throw new ForbiddenException('No access to this PG');
  }

  // ── Items master (global) ─────────────────────────────────────────────

  listItems() {
    return this.prisma.foodItem.findMany({ orderBy: { name: 'asc' } });
  }

  async createItem(input: CreateFoodItemInput) {
    try {
      return await this.prisma.foodItem.create({ data: { name: input.name.trim() } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Item already exists');
      }
      throw e;
    }
  }

  async deleteItem(id: string) {
    try {
      return await this.prisma.foodItem.delete({ where: { id } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new ConflictException('Item is in use in a group or daily menu');
      }
      throw e;
    }
  }

  // ── Groups (per PG, per meal) ─────────────────────────────────────────

  async listGroups(pgId: string, userId: string, role: UserRole) {
    await this.assertScope(pgId, userId, role);
    return this.prisma.foodGroup.findMany({
      where: { pgId },
      orderBy: [{ mealType: 'asc' }, { name: 'asc' }],
      include: { items: { include: { item: true }, orderBy: { sortOrder: 'asc' } } },
    });
  }

  async createGroup(input: CreateFoodGroupInput, userId: string, role: UserRole) {
    await this.assertScope(input.pgId, userId, role);

    const created = await this.prisma.$transaction(async (tx) => {
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
    }).catch((e) => {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('A group with that name already exists for this meal');
      }
      throw e;
    });

    return created;
  }

  async setGroupDefault(groupId: string, userId: string, role: UserRole) {
    const group = await this.prisma.foodGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException();
    await this.assertScope(group.pgId, userId, role);
    return this.prisma.$transaction(async (tx) => {
      await tx.foodGroup.updateMany({
        where: { pgId: group.pgId, mealType: group.mealType, isDefault: true },
        data: { isDefault: false },
      });
      return tx.foodGroup.update({ where: { id: groupId }, data: { isDefault: true } });
    });
  }

  async deleteGroup(groupId: string, userId: string, role: UserRole) {
    const group = await this.prisma.foodGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException();
    await this.assertScope(group.pgId, userId, role);
    return this.prisma.foodGroup.delete({ where: { id: groupId } });
  }

  // ── Daily menu ────────────────────────────────────────────────────────

  /** All menus for a date range. Defaults to a single day. */
  async listDailyMenus(pgId: string, userId: string, role: UserRole, from?: string, to?: string) {
    await this.assertScope(pgId, userId, role);
    const fromDate = from ? new Date(from) : new Date();
    const toDate = to ? new Date(to) : fromDate;
    return this.prisma.dailyMenu.findMany({
      where: { pgId, date: { gte: fromDate, lte: toDate } },
      orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
      include: {
        group: { include: { items: { include: { item: true }, orderBy: { sortOrder: 'asc' } } } },
        items: { include: { item: true } },
      },
    });
  }

  /** Upsert the menu for (pgId, date, mealType). Replaces any prior items. */
  async setDailyMenu(input: SetDailyMenuInput, userId: string, role: UserRole) {
    await this.assertScope(input.pgId, userId, role);

    if (!input.groupId && (!input.itemIds || input.itemIds.length === 0)) {
      throw new BadRequestException('Provide groupId or itemIds');
    }

    const date = new Date(input.date);
    return this.prisma.$transaction(async (tx) => {
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
  async applyDefaultsForDate(pgId: string, date: string, userId: string, role: UserRole) {
    await this.assertScope(pgId, userId, role);
    const target = new Date(date);
    const defaults = await this.prisma.foodGroup.findMany({
      where: { pgId, isDefault: true },
    });
    const meals: MealType[] = ['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER'];
    const created: string[] = [];
    for (const meal of meals) {
      const def = defaults.find((g) => g.mealType === meal);
      if (!def) continue;
      const existing = await this.prisma.dailyMenu.findUnique({
        where: { pgId_date_mealType: { pgId, date: target, mealType: meal } },
      });
      if (existing) continue;
      const m = await this.prisma.dailyMenu.create({
        data: { pgId, date: target, mealType: meal, groupId: def.id },
      });
      created.push(m.id);
    }
    return { applied: created.length };
  }
}
