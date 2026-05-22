import { NextResponse } from 'next/server';

import { reqMeta } from '@/server/common/audit';
import { errorResponse, HttpError, requireUser } from '@/server/common/session';
import {
  GiveNoticeSchema,
  cancelResidentNotice,
  giveResidentNotice,
} from '@/server/services/resident.service';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = GiveNoticeSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid input');
    const updated = await giveResidentNotice(id, parsed.data, user.sub, user.role, reqMeta(req));
    return NextResponse.json(updated);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const updated = await cancelResidentNotice(id, user.sub, user.role, reqMeta(req));
    return NextResponse.json(updated);
  } catch (err) {
    return errorResponse(err);
  }
}
