import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { UserRole } from '@pg/db';

import { CurrentUser, type RequestUser } from '../../common/decorators/current-user';
import { Roles, RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe';
import { CreatePgSchema, PgSettingsSchema, UpdatePgSchema } from './pg.dto';
import { PgService } from './pg.service';

@UseGuards(RolesGuard)
@Controller({ path: 'pgs', version: '1' })
export class PgController {
  constructor(private readonly pgs: PgService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.pgs.list(user.sub, user.role);
  }

  @Get(':pgId')
  get(@Param('pgId') pgId: string, @CurrentUser() user: RequestUser) {
    return this.pgs.get(pgId, user.sub, user.role);
  }

  @Post()
  @Roles(UserRole.OWNER)
  @UsePipes(new ZodValidationPipe(CreatePgSchema))
  create(@Body() body: ReturnType<typeof CreatePgSchema.parse>, @CurrentUser() user: RequestUser) {
    return this.pgs.create(body, user.sub);
  }

  @Patch(':pgId')
  @UsePipes(new ZodValidationPipe(UpdatePgSchema))
  update(
    @Param('pgId') pgId: string,
    @Body() body: ReturnType<typeof UpdatePgSchema.parse>,
    @CurrentUser() user: RequestUser,
  ) {
    return this.pgs.update(pgId, body, user.sub, user.role);
  }

  @Put(':pgId/settings')
  @UsePipes(new ZodValidationPipe(PgSettingsSchema))
  setSettings(
    @Param('pgId') pgId: string,
    @Body() body: ReturnType<typeof PgSettingsSchema.parse>,
    @CurrentUser() user: RequestUser,
  ) {
    return this.pgs.updateSettings(pgId, body, user.sub, user.role);
  }

  @Delete(':pgId')
  @Roles(UserRole.OWNER)
  @HttpCode(204)
  async remove(@Param('pgId') pgId: string, @CurrentUser() user: RequestUser) {
    await this.pgs.remove(pgId, user.role);
  }
}
