import { NextResponse } from 'next/server';

import {
  UpdatePgSchema,
  getPG,
  removePG,
  updatePG,
} from '@/server/services/pg.service';
import { errorResponse, HttpError, requireUser } from '@/server/common/session';

export async function GET(_req: Request, { params }: { params: Promise<{ pgId: string }> }) {
  try {
    const user = await requireUser();
    const { pgId } = await params;
    const pg = await getPG(pgId, user.sub, user.role);
    return NextResponse.json(pg);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ pgId: string }> }) {
  try {
    const user = await requireUser();
    const { pgId } = await params;
    const body = await req.json();
    const parsed = UpdatePgSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid input');
    const pg = await updatePG(pgId, parsed.data, user.sub, user.role);
    return NextResponse.json(pg);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ pgId: string }> }) {
  try {
    const user = await requireUser();
    const { pgId } = await params;
    await removePG(pgId, user.sub, user.role);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
