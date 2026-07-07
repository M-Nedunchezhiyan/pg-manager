import { NextResponse } from 'next/server';

import { errorResponse, HttpError, requireUser } from '@/server/common/session';
import { SetDailyMenuSchema, listDailyMenus, setDailyMenu } from '@/server/services/food.service';

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const pgId = url.searchParams.get('pgId');
    if (!pgId) throw new HttpError(400, 'pgId is required');
    const from = url.searchParams.get('from') ?? undefined;
    const to = url.searchParams.get('to') ?? undefined;
    const menus = await listDailyMenus(pgId, user.sub, user.role, from, to);
    return NextResponse.json(menus);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = SetDailyMenuSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid input');
    const menu = await setDailyMenu(parsed.data, user.sub, user.role);
    return NextResponse.json(menu);
  } catch (err) {
    return errorResponse(err);
  }
}
