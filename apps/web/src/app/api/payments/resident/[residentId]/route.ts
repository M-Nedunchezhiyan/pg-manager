import { NextResponse } from 'next/server';

import { errorResponse, requireUser } from '@/server/common/session';
import { listPaymentsForResident } from '@/server/services/payment.service';

export async function GET(_req: Request, { params }: { params: Promise<{ residentId: string }> }) {
  try {
    const user = await requireUser();
    const { residentId } = await params;
    const payments = await listPaymentsForResident(residentId, user.sub, user.role);
    return NextResponse.json(payments);
  } catch (err) {
    return errorResponse(err);
  }
}
