import { ForbiddenException, Injectable } from '@nestjs/common';
import { BedStatus, PaymentKind, ResidentStatus, UserRole } from '@pg/db';

import { PrismaService } from '../prisma/prisma.service';

export interface MonthMetrics {
  year: number;
  month: number;
  revenue: number;   // RENT + LATE_FEE − REFUND, paise
  expenses: number;  // paise
  net: number;       // revenue − expenses
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async assertScope(pgId: string, userId: string, role: UserRole): Promise<void> {
    if (role === UserRole.OWNER) return;
    const scope = await this.prisma.userPGScope.findUnique({
      where: { userId_pgId: { userId, pgId } },
    });
    if (!scope) throw new ForbiddenException('No access to this PG');
  }

  async pgOverview(pgId: string, userId: string, role: UserRole) {
    await this.assertScope(pgId, userId, role);

    const [activeResidents, beds, payments, expenses] = await Promise.all([
      this.prisma.resident.count({
        where: { pgId, status: { in: [ResidentStatus.ACTIVE, ResidentStatus.NOTICE] } },
      }),
      this.prisma.bed.findMany({
        where: { room: { floor: { pgId } } },
        select: { status: true },
      }),
      this.prisma.payment.findMany({
        where: { resident: { pgId } },
        select: { kind: true, amount: true, lateFee: true, paidOn: true },
      }),
      this.prisma.expense.findMany({
        where: { pgId },
        select: { amount: true, spentOn: true },
      }),
    ]);

    const totalBeds = beds.length;
    const occupied = beds.filter((b) => b.status === BedStatus.OCCUPIED).length;
    const vacant = beds.filter((b) => b.status === BedStatus.VACANT).length;

    // Monthly metrics — last 6 months.
    const now = new Date();
    const months: MonthMetrics[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth() + 1;
      const periodStart = d;
      const periodEnd = new Date(Date.UTC(y, m, 0));

      const revenue = payments
        .filter((p) => {
          const pd = new Date(p.paidOn);
          return pd >= periodStart && pd <= periodEnd;
        })
        .reduce((s, p) => {
          if (p.kind === PaymentKind.REFUND) return s - p.amount;
          return s + p.amount + p.lateFee;
        }, 0);

      const expense = expenses
        .filter((e) => {
          const ed = new Date(e.spentOn);
          return ed >= periodStart && ed <= periodEnd;
        })
        .reduce((s, e) => s + e.amount, 0);

      months.push({ year: y, month: m, revenue, expenses: expense, net: revenue - expense });
    }

    const occupancy = totalBeds > 0 ? Math.round((occupied / totalBeds) * 1000) / 10 : 0;
    const current = months[months.length - 1];

    return {
      counts: {
        activeResidents,
        totalBeds,
        occupied,
        vacant,
        occupancyPercent: occupancy,
      },
      thisMonth: current,
      months,
    };
  }
}
