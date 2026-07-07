import { NextResponse } from 'next/server';

import { errorResponse, HttpError, requireUser } from '@/server/common/session';
import { CreateRoomSchema, createRoom, listRoomsByPg } from '@/server/services/room.service';

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const pgId = new URL(req.url).searchParams.get('pgId');
    if (!pgId) throw new HttpError(400, 'pgId is required');
    const rooms = await listRoomsByPg(pgId, user.sub, user.role);
    return NextResponse.json(rooms);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = CreateRoomSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid input');
    const room = await createRoom(parsed.data, user.sub, user.role);
    return NextResponse.json(room, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
