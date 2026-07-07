import { NextResponse } from 'next/server';

import { errorResponse, HttpError, requireUser } from '@/server/common/session';
import {
  CreateFoodGroupSchema,
  createFoodGroup,
  listFoodGroups,
} from '@/server/services/food.service';

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const pgId = new URL(req.url).searchParams.get('pgId');
    if (!pgId) throw new HttpError(400, 'pgId is required');
    const groups = await listFoodGroups(pgId, user.sub, user.role);
    return NextResponse.json(groups);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = CreateFoodGroupSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid input');
    const group = await createFoodGroup(parsed.data, user.sub, user.role);
    return NextResponse.json(group, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
