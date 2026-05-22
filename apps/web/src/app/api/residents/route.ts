import { ResidentStatus } from '@pg/db';
import { NextResponse } from 'next/server';

import { reqMeta } from '@/server/common/audit';
import { errorResponse, HttpError, requireUser } from '@/server/common/session';
import { listResidents } from '@/server/services/resident.service';

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const pgId = url.searchParams.get('pgId');
    if (!pgId) throw new HttpError(400, 'pgId is required');
    const search = url.searchParams.get('search') ?? undefined;
    const status = (url.searchParams.get('status') as ResidentStatus | 'ALL' | null) ?? undefined;
    const residents = await listResidents(pgId, user.sub, user.role, { search, status: status ?? undefined });
    return NextResponse.json(residents);
  } catch (err) {
    return errorResponse(err);
  }
}

// `reqMeta` is unused here but kept in scope for any future route in this file
// that mutates state and needs to record ip/UA for audit.
void reqMeta;
