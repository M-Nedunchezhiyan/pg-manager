// Daily scan: notify owners + scoped managers about residents whose rent is due
// today or tomorrow. Idempotent — re-running on the same day doesn't duplicate.
//
// Replaces apps/worker/src/jobs/rent-due.scan.ts (BullMQ).

import { NotificationType, ResidentStatus, UserRole } from '@pg/db';
import { NextResponse } from 'next/server';

import { assertCronAuth } from '@/server/common/cron';
import { prisma } from '@/server/common/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: Request) {
  const denied = assertCronAuth(req);
  if (denied) return denied;

  const now = new Date();
  const today = now.getUTCDate();
  const tomorrow = today === 31 ? 1 : today + 1;

  const residents = await prisma.resident.findMany({
    where: {
      status: ResidentStatus.ACTIVE,
      dueDayOfMonth: { in: [today, tomorrow] },
    },
    select: { id: true, fullName: true, pgId: true, dueDayOfMonth: true },
  });

  let notificationsCreated = 0;
  // Idempotency key: same (resident, year, month) shouldn't get a 2nd notification today.
  const seenKey = (residentId: string) => `rent-due:${residentId}:${now.getUTCFullYear()}-${now.getUTCMonth() + 1}`;

  for (const r of residents) {
    const dedupKey = seenKey(r.id);

    // Check if any user already got a RENT_DUE notification for this resident this month.
    const already = await prisma.notification.findFirst({
      where: {
        type: NotificationType.RENT_DUE,
        payload: { path: ['dedupKey'], equals: dedupKey } as never,
      },
      select: { id: true },
    });
    if (already) continue;

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
          payload: { residentId: r.id, pgId: r.pgId, dedupKey },
        },
      });
      notificationsCreated++;
    }
  }

  return NextResponse.json({
    ok: true,
    scannedAt: now.toISOString(),
    candidates: residents.length,
    notificationsCreated,
  });
}
