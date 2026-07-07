import { NextResponse } from 'next/server';

import { errorResponse, requireUser } from '@/server/common/session';
import { getLedger } from '@/server/services/payment.service';

export async function GET(_req: Request, { params }: { params: Promise<{ residentId: string }> }) {
  try {
    const user = await requireUser();
    const { residentId } = await params;
    const ledger = await getLedger(residentId, user.sub, user.role);
    return NextResponse.json(ledger);
  } catch (err) {
    return errorResponse(err);
  }
}
