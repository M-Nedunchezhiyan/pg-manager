import { NextResponse } from 'next/server';

import { errorResponse, HttpError, requireUser } from '@/server/common/session';
import { getBedMap } from '@/server/services/room.service';

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const pgId = new URL(req.url).searchParams.get('pgId');
    if (!pgId) throw new HttpError(400, 'pgId is required');
    const map = await getBedMap(pgId, user.sub, user.role);
    return NextResponse.json(map);
  } catch (err) {
    return errorResponse(err);
  }
}
