import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, limit = 50) {
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items, unread };
  }

  async markRead(userId: string, id: string) {
    const n = await this.prisma.notification.findUnique({ where: { id } });
    if (!n || n.userId !== userId) throw new NotFoundException();
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: n.readAt ?? new Date() },
    });
  }

  async markAllRead(userId: string) {
    const r = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: r.count };
  }
}
