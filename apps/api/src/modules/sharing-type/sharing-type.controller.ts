import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UsePipes } from '@nestjs/common';

import { CurrentUser, type RequestUser } from '../../common/decorators/current-user';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe';
import { CreateSharingTypeSchema, UpdateSharingTypeSchema } from './sharing-type.dto';
import { SharingTypeService } from './sharing-type.service';

@Controller({ path: 'sharing-types', version: '1' })
export class SharingTypeController {
  constructor(private readonly svc: SharingTypeService) {}

  @Get()
  async list(@Query('pgId') pgId: string, @CurrentUser() user: RequestUser) {
    await this.svc.assertScope(pgId, user.sub, user.role);
    return this.svc.list(pgId);
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CreateSharingTypeSchema))
  create(@Body() body: ReturnType<typeof CreateSharingTypeSchema.parse>, @CurrentUser() u: RequestUser) {
    return this.svc.create(body, u.sub, u.role);
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(UpdateSharingTypeSchema))
  update(
    @Param('id') id: string,
    @Body() body: ReturnType<typeof UpdateSharingTypeSchema.parse>,
    @CurrentUser() u: RequestUser,
  ) {
    return this.svc.update(id, body, u.sub, u.role);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() u: RequestUser) {
    await this.svc.remove(id, u.sub, u.role);
  }
}
