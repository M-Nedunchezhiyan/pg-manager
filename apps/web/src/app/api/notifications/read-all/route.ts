import { NextResponse } from 'next/server';

import { errorResponse, requireUser } from '@/server/common/session';
import { markAllNotificationsRead } from '@/server/services/notification.service';

export async function POST() {
  try {
    const user = await requireUser();
    const result = await markAllNotificationsRead(user.sub);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
