import { NextResponse } from 'next/server';

import { errorResponse, requireUser } from '@/server/common/session';
import { deleteFoodItem } from '@/server/services/food.service';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await params;
    await deleteFoodItem(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
