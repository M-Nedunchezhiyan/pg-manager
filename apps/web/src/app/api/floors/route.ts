import { NextResponse } from 'next/server';

import { errorResponse, HttpError, requireUser } from '@/server/common/session';
import { CreateFloorSchema, createFloor, listFloors } from '@/server/services/floor.service';

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const pgId = new URL(req.url).searchParams.get('pgId');
    if (!pgId) throw new HttpError(400, 'pgId is required');
    const floors = await listFloors(pgId, user.sub, user.role);
    return NextResponse.json(floors);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = CreateFloorSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid input');
    const floor = await createFloor(parsed.data, user.sub, user.role);
    return NextResponse.json(floor, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
