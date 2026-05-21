import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UsePipes } from '@nestjs/common';

import { CurrentUser, type RequestUser } from '../../common/decorators/current-user';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe';
import { CreateFloorSchema, UpdateFloorSchema } from './floor.dto';
import { FloorService } from './floor.service';

@Controller({ path: 'floors', version: '1' })
export class FloorController {
  constructor(private readonly floors: FloorService) {}

  @Get()
  async list(@Query('pgId') pgId: string, @CurrentUser() user: RequestUser) {
    await this.floors.assertScope(pgId, user.sub, user.role);
    return this.floors.list(pgId);
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CreateFloorSchema))
  create(@Body() body: ReturnType<typeof CreateFloorSchema.parse>, @CurrentUser() user: RequestUser) {
    return this.floors.create(body, user.sub, user.role);
  }

  @Patch(':floorId')
  @UsePipes(new ZodValidationPipe(UpdateFloorSchema))
  update(
    @Param('floorId') floorId: string,
    @Body() body: ReturnType<typeof UpdateFloorSchema.parse>,
    @CurrentUser() user: RequestUser,
  ) {
    return this.floors.update(floorId, body, user.sub, user.role);
  }

  @Delete(':floorId')
  @HttpCode(204)
  async remove(@Param('floorId') floorId: string, @CurrentUser() user: RequestUser) {
    await this.floors.remove(floorId, user.sub, user.role);
  }
}
