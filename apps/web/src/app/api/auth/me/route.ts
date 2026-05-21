import { NextResponse } from 'next/server';

import { errorResponse, requireUser } from '@/server/common/session';

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({
      id: user.sub,
      email: user.email,
      name: user.name,
      role: user.role,
      pgScopes: user.pgScopes,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
