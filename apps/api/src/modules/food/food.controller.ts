import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, UsePipes } from '@nestjs/common';

import { CurrentUser, type RequestUser } from '../../common/decorators/current-user';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe';
import { CreateFoodGroupSchema, CreateFoodItemSchema, SetDailyMenuSchema } from './food.dto';
import { FoodService } from './food.service';

@Controller({ path: 'food', version: '1' })
export class FoodController {
  constructor(private readonly food: FoodService) {}

  // ── Items master ────────────────────────────────────────────────────
  @Get('items')
  listItems() {
    return this.food.listItems();
  }

  @Post('items')
  @UsePipes(new ZodValidationPipe(CreateFoodItemSchema))
  createItem(@Body() body: ReturnType<typeof CreateFoodItemSchema.parse>) {
    return this.food.createItem(body);
  }

  @Delete('items/:id')
  @HttpCode(204)
  async deleteItem(@Param('id') id: string) {
    await this.food.deleteItem(id);
  }

  // ── Groups ──────────────────────────────────────────────────────────
  @Get('groups')
  listGroups(@Query('pgId') pgId: string, @CurrentUser() u: RequestUser) {
    return this.food.listGroups(pgId, u.sub, u.role);
  }

  @Post('groups')
  @UsePipes(new ZodValidationPipe(CreateFoodGroupSchema))
  createGroup(@Body() body: ReturnType<typeof CreateFoodGroupSchema.parse>, @CurrentUser() u: RequestUser) {
    return this.food.createGroup(body, u.sub, u.role);
  }

  @Post('groups/:id/default')
  setDefault(@Param('id') id: string, @CurrentUser() u: RequestUser) {
    return this.food.setGroupDefault(id, u.sub, u.role);
  }

  @Delete('groups/:id')
  @HttpCode(204)
  async deleteGroup(@Param('id') id: string, @CurrentUser() u: RequestUser) {
    await this.food.deleteGroup(id, u.sub, u.role);
  }

  // ── Daily menu ──────────────────────────────────────────────────────
  @Get('menus')
  listMenus(
    @Query('pgId') pgId: string,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @CurrentUser() u: RequestUser,
  ) {
    return this.food.listDailyMenus(pgId, u.sub, u.role, from, to);
  }

  @Put('menus')
  @UsePipes(new ZodValidationPipe(SetDailyMenuSchema))
  setMenu(@Body() body: ReturnType<typeof SetDailyMenuSchema.parse>, @CurrentUser() u: RequestUser) {
    return this.food.setDailyMenu(body, u.sub, u.role);
  }

  @Post('menus/apply-defaults')
  applyDefaults(
    @Query('pgId') pgId: string,
    @Query('date') date: string,
    @CurrentUser() u: RequestUser,
  ) {
    return this.food.applyDefaultsForDate(pgId, date, u.sub, u.role);
  }
}
