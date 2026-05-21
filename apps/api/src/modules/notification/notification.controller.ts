import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';

import { CurrentUser, type RequestUser } from '../../common/decorators/current-user';
import { NotificationService } from './notification.service';

@Controller({ path: 'notifications', version: '1' })
export class NotificationController {
  constructor(private readonly svc: NotificationService) {}

  @Get()
  list(@CurrentUser() u: RequestUser) {
    return this.svc.list(u.sub);
  }

  @Post(':id/read')
  @HttpCode(200)
  markRead(@Param('id') id: string, @CurrentUser() u: RequestUser) {
    return this.svc.markRead(u.sub, id);
  }

  @Post('read-all')
  @HttpCode(200)
  markAllRead(@CurrentUser() u: RequestUser) {
    return this.svc.markAllRead(u.sub);
  }
}
