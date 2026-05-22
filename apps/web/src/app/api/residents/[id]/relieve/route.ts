import { NextResponse } from 'next/server';

import { reqMeta } from '@/server/common/audit';
import { errorResponse, HttpError, requireUser } from '@/server/common/session';
import { RelieveSchema, relieveResident } from '@/server/services/resident.service';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await req.json();
    const parsed = RelieveSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid input');
    const result = await relieveResident(id, parsed.data, user.sub, user.role, reqMeta(req));
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
