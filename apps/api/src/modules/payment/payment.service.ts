import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentKind, Prisma, ResidentStatus, UserRole } from '@pg/db';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { RecordPaymentInput } from './payment.dto';

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async assertScope(pgId: string, userId: string, role: UserRole): Promise<void> {
    if (role === UserRole.OWNER) return;
    const scope = await this.prisma.userPGScope.findUnique({
      where: { userId_pgId: { userId, pgId } },
    });
    if (!scope) throw new ForbiddenException('No access to this PG');
  }

  /** All payments for a resident, newest first. */
  async listForResident(residentId: string, userId: string, role: UserRole) {
    const r = await this.prisma.resident.findUnique({ where: { id: residentId } });
    if (!r) throw new NotFoundException();
    await this.assertScope(r.pgId, userId, role);
    return this.prisma.payment.findMany({
      where: { residentId },
      orderBy: [{ paidOn: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });
  }

  /**
   * Build a per-resident rent ledger: from joinedOn → current month,
   * for each month emit { month, year, due, paid, lateDays, lateFee, status }.
   */
  async ledger(residentId: string, userId: string, role: UserRole) {
    const r = await this.prisma.resident.findUnique({
      where: { id: residentId },
      include: {
        allocations: { orderBy: { fromDate: 'asc' } },
        pg: { include: { settings: true } },
        payments: { where: { kind: 'RENT' } },
      },
    });
    if (!r) throw new NotFoundException();
    await this.assertScope(r.pgId, userId, role);

    const settings = r.pg.settings;
    const lateFeePerDay = settings?.lateFeePerDay ?? 0;
    const dueDay = r.dueDayOfMonth;
    const allocations = r.allocations;

    const start = new Date(r.joinedOn);
    const end = r.actualLeavingOn ? new Date(r.actualLeavingOn) : new Date();

    const months: Array<{
      year: number;
      month: number;
      rentDue: number;
      paid: number;
      lateDays: number;
      lateFeeOwed: number;
      lateFeePaid: number;
      status: 'PAID' | 'PARTIAL' | 'DUE' | 'OVERDUE' | 'UPCOMING';
    }> = [];

    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    const lastMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    const today = new Date();

    while (cursor <= lastMonth) {
      const year = cursor.getUTCFullYear();
      const month = cursor.getUTCMonth() + 1;

      // Rent for that month = rentSnapshot of the allocation covering it.
      const monthStart = new Date(Date.UTC(year, month - 1, 1));
      const monthEnd = new Date(Date.UTC(year, month, 0));
      const activeAlloc = allocations.find((a) => {
        const from = new Date(a.fromDate);
        const to = a.toDate ? new Date(a.toDate) : new Date('9999-12-31');
        return from <= monthEnd && to >= monthStart;
      });
      const rentDue = activeAlloc?.rentSnapshot ?? 0;

      const paymentsForMonth = r.payments.filter(
        (p) => p.forYear === year && p.forMonth === month,
      );
      const paid = paymentsForMonth.reduce((s, p) => s + p.amount, 0);
      const lateFeePaid = paymentsForMonth.reduce((s, p) => s + p.lateFee, 0);

      const dueDate = new Date(Date.UTC(year, month - 1, Math.min(dueDay, monthEnd.getUTCDate())));
      const isPast = today > dueDate;
      const lateDays = paid >= rentDue ? 0 : isPast ? Math.floor((today.getTime() - dueDate.getTime()) / 86_400_000) : 0;
      const lateFeeOwed = lateDays * lateFeePerDay;

      let status: 'PAID' | 'PARTIAL' | 'DUE' | 'OVERDUE' | 'UPCOMING';
      if (paid >= rentDue) status = 'PAID';
      else if (paid > 0) status = 'PARTIAL';
      else if (today < dueDate) status = today.getUTCMonth() === monthStart.getUTCMonth() ? 'DUE' : 'UPCOMING';
      else status = 'OVERDUE';

      months.push({ year, month, rentDue, paid, lateDays, lateFeeOwed, lateFeePaid, status });

      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    return {
      resident: { id: r.id, fullName: r.fullName, status: r.status, dueDayOfMonth: r.dueDayOfMonth },
      lateFeePerDay,
      months: months.reverse(), // newest first
    };
  }

  /** PG-wide dues summary: who owes what right now. */
  async pgDues(pgId: string, userId: string, role: UserRole) {
    await this.assertScope(pgId, userId, role);
    const residents = await this.prisma.resident.findMany({
      where: { pgId, status: { in: [ResidentStatus.ACTIVE, ResidentStatus.NOTICE] } },
      include: {
        allocations: { where: { toDate: null }, take: 1 },
        payments: { where: { kind: 'RENT' } },
      },
      orderBy: { fullName: 'asc' },
    });

    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth() + 1;

    return residents.map((r) => {
      const due = r.allocations[0]?.rentSnapshot ?? 0;
      const paid = r.payments
        .filter((p) => p.forYear === y && p.forMonth === m)
        .reduce((s, p) => s + p.amount, 0);
      return {
        id: r.id,
        fullName: r.fullName,
        dueDayOfMonth: r.dueDayOfMonth,
        currentMonthDue: due,
        currentMonthPaid: paid,
        balance: Math.max(0, due - paid),
      };
    });
  }

  async record(
    input: RecordPaymentInput,
    userId: string,
    role: UserRole,
    meta: { ip?: string; userAgent?: string } = {},
  ) {
    const resident = await this.prisma.resident.findUnique({ where: { id: input.residentId } });
    if (!resident) throw new NotFoundException();
    await this.assertScope(resident.pgId, userId, role);

    if (input.kind === PaymentKind.RENT) {
      if (!input.forMonth || !input.forYear) {
        throw new BadRequestException('RENT payments require forMonth and forYear');
      }
    }

    try {
      const payment = await this.prisma.payment.create({
        data: {
          residentId: input.residentId,
          kind: input.kind,
          forMonth: input.forMonth,
          forYear: input.forYear,
          amount: input.amount,
          lateFee: input.lateFee,
          paidOn: new Date(input.paidOn),
          method: input.method,
          reference: input.reference,
          notes: input.notes,
          recordedBy: userId,
        },
      });

      await this.audit.record({
        userId,
        action: 'payment.record',
        entity: 'payment',
        entityId: payment.id,
        pgId: resident.pgId,
        after: { kind: payment.kind, amount: payment.amount, forMonth: payment.forMonth, forYear: payment.forYear },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      // Create a notification for the recording user (visible in bell).
      await this.prisma.notification.create({
        data: {
          userId,
          type: 'PAYMENT_RECEIVED',
          title: `Payment recorded for ${resident.fullName}`,
          body: `₹${(payment.amount / 100).toFixed(2)} via ${payment.method}`,
          payload: { paymentId: payment.id, residentId: resident.id, pgId: resident.pgId },
        },
      });

      return payment;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('A payment for this resident/kind/month already exists');
      }
      throw e;
    }
  }
}
