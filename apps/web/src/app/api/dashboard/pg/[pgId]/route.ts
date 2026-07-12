import { NextResponse } from 'next/server';

import { errorResponse, requireUser } from '@/server/common/session';
import { getPgDashboard } from '@/server/services/pg.service';

export async function GET(_req: Request, { params }: { params: Promise<{ pgId: string }> }) {
  try {
    const user = await requireUser();
    const { pgId } = await params;
    const data = await getPgDashboard(pgId, user.sub, user.role);
    return NextResponse.json(data);
  } catch (err) {
    return errorResponse(err);
  }
}
