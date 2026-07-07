import { NextResponse } from 'next/server';

import { errorResponse, requireUser } from '@/server/common/session';
import { deleteFoodGroup } from '@/server/services/food.service';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await deleteFoodGroup(id, user.sub, user.role);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
