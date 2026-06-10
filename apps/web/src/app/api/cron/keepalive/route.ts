// Pings the database every 4 hours so Neon doesn't auto-suspend the compute
// after a period of inactivity (free tier scale-to-zero). One trivial query is
// enough to keep it warm and avoid a cold-start delay on the next real request.
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
