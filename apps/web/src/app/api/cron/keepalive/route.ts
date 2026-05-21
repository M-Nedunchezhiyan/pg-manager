// Pings the database every 4 hours so Supabase doesn't auto-pause the project
// after 7 days of inactivity. One trivial query is enough to count as activity.
//
// Schedule defined in vercel.json. Authorization enforced via CRON_SECRET.

import { NextResponse } from 'next/server';

import { assertCronAuth } from '@/server/common/cron';
import { prisma } from '@/server/common/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const denied = assertCronAuth(req);
  if (denied) return denied;

  const rows = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 as ok`;
  const ok = rows[0]?.ok === 1;
  return NextResponse.json({ ok, at: new Date().toISOString() });
}
