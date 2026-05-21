import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UsePipes,
} from '@nestjs/common';
import { ResidentStatus } from '@pg/db';
import type { Request } from 'express';

import { CurrentUser, type RequestUser } from '../../common/decorators/current-user';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe';
import {
  GiveNoticeSchema,
  OnboardResidentSchema,
  RelieveSchema,
  UpdateResidentSchema,
} from './resident.dto';
import { ResidentService } from './resident.service';

@Controller({ path: 'residents', version: '1' })
export class ResidentController {
  constructor(private readonly residents: ResidentService) {}

  @Get()
  async list(
    @Query('pgId') pgId: string,
    @Query('search') search: string | undefined,
    @Query('status') status: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    if (!pgId) throw new BadRequestException('pgId is required');
    await this.residents.assertScope(pgId, user.sub, user.role);
    const opts: { search?: string; status?: ResidentStatus | 'ALL' } = {};
    if (search) opts.search = search;
    if (status) opts.status = status as ResidentStatus | 'ALL';
    return this.residents.list(pgId, opts);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.residents.get(id, user.sub, user.role);
  }

  @Post('onboard')
  @UsePipes(new ZodValidationPipe(OnboardResidentSchema))
  onboard(
    @Body() body: ReturnType<typeof OnboardResidentSchema.parse>,
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
  ) {
    return this.residents.onboard(body, user.sub, user.role, {
      ip: this.clientIp(req),
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(UpdateResidentSchema))
  update(
    @Param('id') id: string,
    @Body() body: ReturnType<typeof UpdateResidentSchema.parse>,
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
  ) {
    return this.residents.update(id, body, user.sub, user.role, {
      ip: this.clientIp(req),
      userAgent: req.headers['user-agent'],
    });
  }

  @Post(':id/notice')
  @UsePipes(new ZodValidationPipe(GiveNoticeSchema))
  notice(
    @Param('id') id: string,
    @Body() body: ReturnType<typeof GiveNoticeSchema.parse>,
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
  ) {
    return this.residents.giveNotice(id, body, user.sub, user.role, {
      ip: this.clientIp(req),
      userAgent: req.headers['user-agent'],
    });
  }

  @Delete(':id/notice')
  @HttpCode(200)
  cancelNotice(@Param('id') id: string, @CurrentUser() user: RequestUser, @Req() req: Request) {
    return this.residents.cancelNotice(id, user.sub, user.role, {
      ip: this.clientIp(req),
      userAgent: req.headers['user-agent'],
    });
  }

  @Post(':id/relieve')
  @UsePipes(new ZodValidationPipe(RelieveSchema))
  relieve(
    @Param('id') id: string,
    @Body() body: ReturnType<typeof RelieveSchema.parse>,
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
  ) {
    return this.residents.relieve(id, body, user.sub, user.role, {
      ip: this.clientIp(req),
      userAgent: req.headers['user-agent'],
    });
  }

  private clientIp(req: Request): string | undefined {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string') return xff.split(',')[0]?.trim();
    if (Array.isArray(xff)) return xff[0];
    return req.socket.remoteAddress ?? undefined;
  }
}
