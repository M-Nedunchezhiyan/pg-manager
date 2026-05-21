import { Body, Controller, Get, Param, Post, Query, Req, UsePipes } from '@nestjs/common';
import type { Request } from 'express';

import { CurrentUser, type RequestUser } from '../../common/decorators/current-user';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe';
import { RecordPaymentSchema } from './payment.dto';
import { PaymentService } from './payment.service';

@Controller({ path: 'payments', version: '1' })
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}

  @Get('resident/:residentId')
  listForResident(@Param('residentId') id: string, @CurrentUser() u: RequestUser) {
    return this.payments.listForResident(id, u.sub, u.role);
  }

  @Get('ledger/:residentId')
  ledger(@Param('residentId') id: string, @CurrentUser() u: RequestUser) {
    return this.payments.ledger(id, u.sub, u.role);
  }

  @Get('dues')
  pgDues(@Query('pgId') pgId: string, @CurrentUser() u: RequestUser) {
    return this.payments.pgDues(pgId, u.sub, u.role);
  }

  @Post()
  @UsePipes(new ZodValidationPipe(RecordPaymentSchema))
  record(
    @Body() body: ReturnType<typeof RecordPaymentSchema.parse>,
    @CurrentUser() u: RequestUser,
    @Req() req: Request,
  ) {
    return this.payments.record(body, u.sub, u.role, {
      ip: this.ip(req),
      userAgent: req.headers['user-agent'],
    });
  }

  private ip(req: Request): string | undefined {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string') return xff.split(',')[0]?.trim();
    return req.socket.remoteAddress ?? undefined;
  }
}
