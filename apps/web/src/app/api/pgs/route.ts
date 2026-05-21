import { NextResponse } from 'next/server';

import { CreatePgSchema, createPG, listPGs } from '@/server/services/pg.service';
import { errorResponse, HttpError, requireUser } from '@/server/common/session';

export async function GET() {
  try {
    const user = await requireUser();
    const pgs = await listPGs(user.sub, user.role);
    return NextResponse.json(pgs);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = CreatePgSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid input');
    const pg = await createPG(parsed.data, user.sub, user.role);
    return NextResponse.json(pg, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
