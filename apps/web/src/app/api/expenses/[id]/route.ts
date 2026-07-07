import { NextResponse } from 'next/server';

import { errorResponse, requireUser } from '@/server/common/session';
import { removeExpense } from '@/server/services/expense.service';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await removeExpense(id, user.sub, user.role);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
