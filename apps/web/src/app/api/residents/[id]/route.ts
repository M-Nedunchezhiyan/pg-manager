import { NextResponse } from 'next/server';

import { reqMeta } from '@/server/common/audit';
import { errorResponse, HttpError, requireUser } from '@/server/common/session';
import {
  UpdateResidentSchema,
  getResident,
  updateResident,
} from '@/server/services/resident.service';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const resident = await getResident(id, user.sub, user.role);
    return NextResponse.json(resident);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await req.json();
    const parsed = UpdateResidentSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid input');
    const updated = await updateResident(id, parsed.data, user.sub, user.role, reqMeta(req));
    return NextResponse.json(updated);
  } catch (err) {
    return errorResponse(err);
  }
}
