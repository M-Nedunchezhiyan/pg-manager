import { NextResponse } from 'next/server';

import { reqMeta } from '@/server/common/audit';
import { errorResponse, HttpError, requireUser } from '@/server/common/session';
import { RecordPaymentSchema, recordPayment } from '@/server/services/payment.service';

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = RecordPaymentSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid input');
    const payment = await recordPayment(parsed.data, user.sub, user.role, reqMeta(req));
    return NextResponse.json(payment, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
