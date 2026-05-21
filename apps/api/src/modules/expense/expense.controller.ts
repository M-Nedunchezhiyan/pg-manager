import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Req, UsePipes } from '@nestjs/common';
import type { Request } from 'express';

import { CurrentUser, type RequestUser } from '../../common/decorators/current-user';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe';
import { CreateExpenseSchema } from './expense.dto';
import { ExpenseService } from './expense.service';

@Controller({ path: 'expenses', version: '1' })
export class ExpenseController {
  constructor(private readonly svc: ExpenseService) {}

  @Get()
  async list(
    @Query('pgId') pgId: string,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @CurrentUser() u: RequestUser,
  ) {
    await this.svc.assertScope(pgId, u.sub, u.role);
    return this.svc.list(pgId, { from, to });
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CreateExpenseSchema))
  create(
    @Body() body: ReturnType<typeof CreateExpenseSchema.parse>,
    @CurrentUser() u: RequestUser,
    @Req() req: Request,
  ) {
    return this.svc.create(body, u.sub, u.role, {
      ip: typeof req.headers['x-forwarded-for'] === 'string' ? req.headers['x-forwarded-for'].split(',')[0]?.trim() : req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() u: RequestUser) {
    await this.svc.remove(id, u.sub, u.role);
  }
}
