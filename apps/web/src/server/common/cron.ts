// Vercel Cron sends Authorization: Bearer ${CRON_SECRET} on scheduled invocations.
// This helper rejects anything else, so cron endpoints can't be hit by random callers.

import { NextResponse } from 'next/server';

export function assertCronAuth(req: Request): NextResponse | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ message: 'CRON_SECRET not configured' }, { status: 500 });
  }
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
