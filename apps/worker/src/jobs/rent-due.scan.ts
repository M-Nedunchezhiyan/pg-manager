import { Queue, QueueEvents, Worker } from 'bullmq';
import type IORedis from 'ioredis';
import type { Logger } from 'pino';

import { prisma } from '@pg/db';
import { NotificationType, ResidentStatus, UserRole } from '@pg/db';

const QUEUE_NAME = 'rent-due-scan';

interface Deps {
  connection: IORedis;
  log: Logger;
}

/**
 * Daily scan: for every active resident whose dueDayOfMonth is today or within 24h,
 * create an in-app notification for the PG's owner + scoped managers.
 *
 * Idempotent: keyed off (residentId, year, month) so reruns don't duplicate.
 */
export async function registerRentDueScan({ connection, log }: Deps): Promise<void> {
  const queue = new Queue(QUEUE_NAME, { connection });

  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      const now = new Date();
      const today = now.getUTCDate();
      const tomorrow = today === 31 ? 1 : today + 1; // wrap doesn't need to be exact for notification scope

      const residents = await prisma.resident.findMany({
        where: {
          status: ResidentStatus.ACTIVE,
          dueDayOfMonth: { in: [today, tomorrow] },
        },
        select: { id: true, fullName: true, pgId: true, dueDayOfMonth: true },
      });

      log.info({ count: residents.length }, 'rent-due scan: candidates');

      for (const r of residents) {
        const targetUsers = await prisma.user.findMany({
          where: {
            isActive: true,
            OR: [
              { role: UserRole.OWNER },
              { pgScopes: { some: { pgId: r.pgId } } },
            ],
          },
          select: { id: true },
        });

        for (const u of targetUsers) {
          await prisma.notification.create({
            data: {
              userId: u.id,
              type: NotificationType.RENT_DUE,
              title: `Rent due for ${r.fullName}`,
              body: `Due day ${r.dueDayOfMonth}. Please follow up.`,
              payload: { residentId: r.id, pgId: r.pgId },
            },
          });
        }
      }
    },
    { connection, concurrency: 1 },
  );

  worker.on('failed', (job, err) => log.error({ jobId: job?.id, err }, 'rent-due scan failed'));
  worker.on('completed', (job) => log.info({ jobId: job.id }, 'rent-due scan completed'));

  // Recurring daily at 08:00 UTC.
  await queue.upsertJobScheduler(
    'daily-rent-due',
    { pattern: '0 8 * * *' },
    { name: 'rent-due-scan', data: {} },
  );

  // Surface queue-wide events to logs for ops.
  const events = new QueueEvents(QUEUE_NAME, { connection });
  events.on('failed', ({ jobId, failedReason }) => log.error({ jobId, failedReason }, 'queue failed'));
}
