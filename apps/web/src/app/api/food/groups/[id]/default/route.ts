import { NextResponse } from 'next/server';

import { errorResponse, requireUser } from '@/server/common/session';
import { setFoodGroupDefault } from '@/server/services/food.service';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const group = await setFoodGroupDefault(id, user.sub, user.role);
    return NextResponse.json(group);
  } catch (err) {
    return errorResponse(err);
  }
}
