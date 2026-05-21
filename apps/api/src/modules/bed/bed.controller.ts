import { Body, Controller, Get, Param, Patch, Query, UsePipes } from '@nestjs/common';

import { CurrentUser, type RequestUser } from '../../common/decorators/current-user';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe';
import { UpdateBedSchema } from './bed.dto';
import { BedService } from './bed.service';

@Controller({ path: 'beds', version: '1' })
export class BedController {
  constructor(private readonly beds: BedService) {}

  @Get('map')
  async map(@Query('pgId') pgId: string, @CurrentUser() u: RequestUser) {
    await this.beds.assertScope(pgId, u.sub, u.role);
    return this.beds.map(pgId);
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(UpdateBedSchema))
  update(
    @Param('id') id: string,
    @Body() body: ReturnType<typeof UpdateBedSchema.parse>,
    @CurrentUser() u: RequestUser,
  ) {
    return this.beds.update(id, body, u.sub, u.role);
  }
}
