import { NextResponse } from 'next/server';

import { errorResponse, HttpError, requireUser } from '@/server/common/session';
import { AssignManagerSchema, assignPgManager, getPgManager, removePgManager } from '@/server/services/manager.service';

// argon2 is a native module and cannot run on the Edge runtime.
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ pgId: string }> }) {
  try {
    const user = await requireUser();
    const { pgId } = await params;
    const manager = await getPgManager(pgId, user.role);
    return NextResponse.json({ manager });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ pgId: string }> }) {
  try {
    const user = await requireUser();
    const { pgId } = await params;
    const body = await req.json();
    const parsed = AssignManagerSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid input');
    const manager = await assignPgManager(pgId, parsed.data, user.sub, user.role);
    return NextResponse.json(manager, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ pgId: string }> }) {
  try {
    const user = await requireUser();
    const { pgId } = await params;
    await removePgManager(pgId, user.sub, user.role);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
