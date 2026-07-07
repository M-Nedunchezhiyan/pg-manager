import { NextResponse } from 'next/server';

import { errorResponse, HttpError, requireUser } from '@/server/common/session';
import { applyDefaultsForDate } from '@/server/services/food.service';

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const pgId = url.searchParams.get('pgId');
    const date = url.searchParams.get('date');
    if (!pgId || !date) throw new HttpError(400, 'pgId and date are required');
    const result = await applyDefaultsForDate(pgId, date, user.sub, user.role);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
