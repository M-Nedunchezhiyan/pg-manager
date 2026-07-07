import { NextResponse } from 'next/server';

import { errorResponse, requireUser } from '@/server/common/session';
import { markNotificationRead } from '@/server/services/notification.service';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const notification = await markNotificationRead(user.sub, id);
    return NextResponse.json(notification);
  } catch (err) {
    return errorResponse(err);
  }
}
