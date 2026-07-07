// Ported from apps/api/src/modules/notification.
// Framework-agnostic: takes prisma by import, no DI container.

import { prisma } from '@/server/common/prisma';
import { HttpError } from '@/server/common/session';

export async function listNotifications(userId: string, limit = 50) {
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { items, unread };
}

export async function markNotificationRead(userId: string, id: string) {
  const n = await prisma.notification.findUnique({ where: { id } });
  if (!n || n.userId !== userId) throw new HttpError(404, 'Notification not found');
  return prisma.notification.update({
    where: { id },
    data: { readAt: n.readAt ?? new Date() },
  });
}

export async function markAllNotificationsRead(userId: string) {
  const r = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { updated: r.count };
}
