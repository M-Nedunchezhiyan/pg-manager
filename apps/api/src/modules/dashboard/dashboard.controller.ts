import { Controller, Get, Param } from '@nestjs/common';

import { CurrentUser, type RequestUser } from '../../common/decorators/current-user';
import { DashboardService } from './dashboard.service';

@Controller({ path: 'dashboard', version: '1' })
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('pg/:pgId')
  overview(@Param('pgId') pgId: string, @CurrentUser() user: RequestUser) {
    return this.dashboard.pgOverview(pgId, user.sub, user.role);
  }
}
