process.env['SHARED_CIPHER_KEY'] =
  '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
process.env['PII_ENCRYPTION_KEY'] =
  '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff';
process.env['DATABASE_URL'] = 'postgresql://x:y@localhost:5432/z?schema=public';
process.env['REDIS_URL'] = 'redis://localhost:6379';
process.env['API_URL'] = 'http://localhost:4000';
process.env['WEB_URL'] = 'http://localhost:3000';
process.env['CORS_ORIGIN'] = 'http://localhost:3000';
process.env['JWT_ACCESS_SECRET'] = 'a'.repeat(40);
process.env['JWT_REFRESH_SECRET'] = 'b'.repeat(40);
process.env['STORAGE_ROOT'] = '/tmp/pgm-test';

import { UserRole } from '@pg/db';

import { PaymentService } from './payment.service';

/**
 * Ledger math test — uses a fake PrismaService that returns canned data,
 * so we don't need a real DB to verify status / late-fee / paid columns.
 */

function buildResident({
  joinedOn,
  dueDayOfMonth,
  rentSnapshot,
  lateFeePerDay,
  payments,
}: {
  joinedOn: Date;
  dueDayOfMonth: number;
  rentSnapshot: number;
  lateFeePerDay: number;
  payments: Array<{ forYear: number; forMonth: number; amount: number; lateFee: number; kind: 'RENT' }>;
}) {
  return {
    id: 'r1',
    pgId: 'pg1',
    fullName: 'Test',
    status: 'ACTIVE' as const,
    dueDayOfMonth,
    joinedOn,
    actualLeavingOn: null,
    pg: { settings: { lateFeePerDay } },
    allocations: [{ id: 'a1', fromDate: joinedOn, toDate: null, rentSnapshot }],
    payments,
  };
}

function makePrisma(resident: ReturnType<typeof buildResident>) {
  return {
    resident: { findUnique: async () => resident },
    userPGScope: { findUnique: async () => ({}) },
  } as never;
}

const audit = { record: async () => undefined } as never;

describe('PaymentService.ledger', () => {
  it('marks current month with no payment as DUE (when before due date)', async () => {
    // Joined 2 days ago this month, no payment yet, due day is 4 days from now → DUE
    const now = new Date();
    const joined = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), Math.max(1, now.getUTCDate() - 2)));
    const dueDay = Math.min(28, now.getUTCDate() + 4);
    const svc = new PaymentService(
      makePrisma(
        buildResident({
          joinedOn: joined,
          dueDayOfMonth: dueDay,
          rentSnapshot: 500_000,
          lateFeePerDay: 5000,
          payments: [],
        }),
      ),
      audit,
    );
    const out = await svc.ledger('r1', 'u1', UserRole.OWNER);
    expect(out.months[0]?.status).toBe('DUE');
    expect(out.months[0]?.rentDue).toBe(500_000);
    expect(out.months[0]?.paid).toBe(0);
  });

  it('marks fully-paid month as PAID with 0 late fee', async () => {
    const now = new Date();
    const joined = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const svc = new PaymentService(
      makePrisma(
        buildResident({
          joinedOn: joined,
          dueDayOfMonth: 5,
          rentSnapshot: 500_000,
          lateFeePerDay: 5000,
          payments: [
            {
              forYear: now.getUTCFullYear(),
              forMonth: now.getUTCMonth() + 1,
              amount: 500_000,
              lateFee: 0,
              kind: 'RENT',
            },
          ],
        }),
      ),
      audit,
    );
    const out = await svc.ledger('r1', 'u1', UserRole.OWNER);
    expect(out.months[0]?.status).toBe('PAID');
    expect(out.months[0]?.paid).toBe(500_000);
    expect(out.months[0]?.lateFeeOwed).toBe(0);
  });

  it('marks partially-paid as PARTIAL', async () => {
    const now = new Date();
    const joined = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const svc = new PaymentService(
      makePrisma(
        buildResident({
          joinedOn: joined,
          dueDayOfMonth: 5,
          rentSnapshot: 500_000,
          lateFeePerDay: 5000,
          payments: [
            {
              forYear: now.getUTCFullYear(),
              forMonth: now.getUTCMonth() + 1,
              amount: 200_000,
              lateFee: 0,
              kind: 'RENT',
            },
          ],
        }),
      ),
      audit,
    );
    const out = await svc.ledger('r1', 'u1', UserRole.OWNER);
    expect(out.months[0]?.status).toBe('PARTIAL');
    expect(out.months[0]?.paid).toBe(200_000);
  });

  it('marks past-due unpaid month as OVERDUE with positive lateFeeOwed', async () => {
    const joined = new Date('2024-01-01T00:00:00Z'); // long ago
    const svc = new PaymentService(
      makePrisma(
        buildResident({
          joinedOn: joined,
          dueDayOfMonth: 5,
          rentSnapshot: 500_000,
          lateFeePerDay: 5000, // ₹50/day
          payments: [],
        }),
      ),
      audit,
    );
    const out = await svc.ledger('r1', 'u1', UserRole.OWNER);
    const jan2024 = out.months.find((m) => m.year === 2024 && m.month === 1);
    expect(jan2024?.status).toBe('OVERDUE');
    expect((jan2024?.lateFeeOwed ?? 0)).toBeGreaterThan(0);
    expect(jan2024?.lateDays).toBeGreaterThan(0);
  });
});
