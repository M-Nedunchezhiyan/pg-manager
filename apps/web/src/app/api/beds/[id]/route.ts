import { NextResponse } from 'next/server';

import { errorResponse, HttpError, requireUser } from '@/server/common/session';
import { UpdateBedSchema, updateBed } from '@/server/services/room.service';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await req.json();
    const parsed = UpdateBedSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid input');
    const bed = await updateBed(id, parsed.data, user.sub, user.role);
    return NextResponse.json(bed);
  } catch (err) {
    return errorResponse(err);
  }
}
