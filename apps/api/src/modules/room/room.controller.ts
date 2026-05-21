import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UsePipes } from '@nestjs/common';

import { CurrentUser, type RequestUser } from '../../common/decorators/current-user';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe';
import { CreateRoomSchema, UpdateRoomSchema } from './room.dto';
import { RoomService } from './room.service';

@Controller({ path: 'rooms', version: '1' })
export class RoomController {
  constructor(private readonly rooms: RoomService) {}

  @Get()
  async list(
    @Query('pgId') pgId: string | undefined,
    @Query('floorId') floorId: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    if (floorId) {
      // Scope check via floor → pg
      const data = await this.rooms.listByFloor(floorId);
      if (data[0]?.floor?.pgId) await this.rooms.assertScope(data[0].floor.pgId, user.sub, user.role);
      return data;
    }
    if (pgId) {
      await this.rooms.assertScope(pgId, user.sub, user.role);
      return this.rooms.listByPg(pgId);
    }
    throw new BadRequestException('pgId or floorId is required');
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CreateRoomSchema))
  create(@Body() body: ReturnType<typeof CreateRoomSchema.parse>, @CurrentUser() u: RequestUser) {
    return this.rooms.create(body, u.sub, u.role);
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(UpdateRoomSchema))
  update(
    @Param('id') id: string,
    @Body() body: ReturnType<typeof UpdateRoomSchema.parse>,
    @CurrentUser() u: RequestUser,
  ) {
    return this.rooms.update(id, body, u.sub, u.role);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() u: RequestUser) {
    await this.rooms.remove(id, u.sub, u.role);
  }
}
