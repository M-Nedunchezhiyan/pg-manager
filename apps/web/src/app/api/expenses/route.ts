import { NextResponse } from 'next/server';

import { reqMeta } from '@/server/common/audit';
import { errorResponse, HttpError, requireUser } from '@/server/common/session';
import { CreateExpenseSchema, createExpense, listExpenses } from '@/server/services/expense.service';

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const pgId = url.searchParams.get('pgId');
    if (!pgId) throw new HttpError(400, 'pgId is required');
    const from = url.searchParams.get('from') ?? undefined;
    const to = url.searchParams.get('to') ?? undefined;
    const expenses = await listExpenses(pgId, user.sub, user.role, { from, to });
    return NextResponse.json(expenses);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = CreateExpenseSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid input');
    const expense = await createExpense(parsed.data, user.sub, user.role, reqMeta(req));
    return NextResponse.json(expense, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
