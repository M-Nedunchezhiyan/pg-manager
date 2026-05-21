import { NextResponse } from 'next/server';

import { PgSettingsSchema, updatePgSettings } from '@/server/services/pg.service';
import { errorResponse, HttpError, requireUser } from '@/server/common/session';

export async function PUT(req: Request, { params }: { params: Promise<{ pgId: string }> }) {
  try {
    const user = await requireUser();
    const { pgId } = await params;
    const body = await req.json();
    const parsed = PgSettingsSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid input');
    const settings = await updatePgSettings(pgId, parsed.data, user.sub, user.role);
    return NextResponse.json(settings);
  } catch (err) {
    return errorResponse(err);
  }
}
