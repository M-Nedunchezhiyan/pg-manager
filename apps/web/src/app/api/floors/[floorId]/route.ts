import { NextResponse } from 'next/server';

import { errorResponse, HttpError, requireUser } from '@/server/common/session';
import { UpdateFloorSchema, removeFloor, updateFloor } from '@/server/services/floor.service';

export async function PATCH(req: Request, { params }: { params: Promise<{ floorId: string }> }) {
  try {
    const user = await requireUser();
    const { floorId } = await params;
    const body = await req.json();
    const parsed = UpdateFloorSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid input');
    const floor = await updateFloor(floorId, parsed.data, user.sub, user.role);
    return NextResponse.json(floor);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ floorId: string }> }) {
  try {
    const user = await requireUser();
    const { floorId } = await params;
    await removeFloor(floorId, user.sub, user.role);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
