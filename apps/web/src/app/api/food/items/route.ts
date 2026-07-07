import { NextResponse } from 'next/server';

import { errorResponse, HttpError, requireUser } from '@/server/common/session';
import { CreateFoodItemSchema, createFoodItem, listFoodItems } from '@/server/services/food.service';

export async function GET() {
  try {
    await requireUser();
    const items = await listFoodItems();
    return NextResponse.json(items);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    await requireUser();
    const body = await req.json();
    const parsed = CreateFoodItemSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid input');
    const item = await createFoodItem(parsed.data);
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
