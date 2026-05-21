import { Controller, Get, HttpCode } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { PrismaService } from '../prisma/prisma.service';

@SkipThrottle()
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  @HttpCode(200)
  health(): { status: 'ok'; uptime: number } {
    return { status: 'ok', uptime: process.uptime() };
  }

  @Get('readyz')
  @HttpCode(200)
  async ready(): Promise<{ status: 'ready' | 'not-ready'; db: 'ok' | 'fail' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', db: 'ok' };
    } catch {
      return { status: 'not-ready', db: 'fail' };
    }
  }
}
