import { NextResponse } from 'next/server';

import { errorResponse, HttpError, requireUser } from '@/server/common/session';
import {
  UpdateSharingTypeSchema,
  removeSharingType,
  updateSharingType,
} from '@/server/services/floor.service';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await req.json();
    const parsed = UpdateSharingTypeSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid input');
    const sharingType = await updateSharingType(id, parsed.data, user.sub, user.role);
    return NextResponse.json(sharingType);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await removeSharingType(id, user.sub, user.role);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
