import { NextResponse } from 'next/server';

import { errorResponse, requireUser } from '@/server/common/session';
import { listNotifications } from '@/server/services/notification.service';

export async function GET() {
  try {
    const user = await requireUser();
    const result = await listNotifications(user.sub);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
