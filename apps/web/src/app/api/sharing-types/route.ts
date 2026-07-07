import { NextResponse } from 'next/server';

import { errorResponse, HttpError, requireUser } from '@/server/common/session';
import {
  CreateSharingTypeSchema,
  createSharingType,
  listSharingTypes,
} from '@/server/services/floor.service';

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const pgId = new URL(req.url).searchParams.get('pgId');
    if (!pgId) throw new HttpError(400, 'pgId is required');
    const sharingTypes = await listSharingTypes(pgId, user.sub, user.role);
    return NextResponse.json(sharingTypes);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = CreateSharingTypeSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid input');
    const sharingType = await createSharingType(parsed.data, user.sub, user.role);
    return NextResponse.json(sharingType, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
