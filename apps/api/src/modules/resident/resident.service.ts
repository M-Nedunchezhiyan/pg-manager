import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BedStatus,
  PaymentKind,
  PaymentMethod,
  Prisma,
  ResidentStatus,
  UserRole,
} from '@pg/db';

import { encryptPII, hashPII } from '../../common/crypto/pii';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  GiveNoticeInput,
  OnboardResidentInput,
  RelieveInput,
  UpdateResidentInput,
} from './resident.dto';

@Injectable()
export class ResidentService {
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

  // ── List + search ──────────────────────────────────────────────────────

  async list(pgId: string, opts: { search?: string; status?: ResidentStatus | 'ALL' } = {}) {
    const where: Prisma.ResidentWhereInput = { pgId };
    if (opts.status && opts.status !== 'ALL') where.status = opts.status;
    else where.status = { in: [ResidentStatus.ACTIVE, ResidentStatus.NOTICE] };

    if (opts.search) {
      const s = opts.search.trim();
      const phoneLike = s.replace(/\D/g, '');
      where.OR = [
        { fullName: { contains: s, mode: 'insensitive' } },
        { workOrInstitution: { contains: s, mode: 'insensitive' } },
        ...(phoneLike.length >= 6 ? [{ phoneHash: hashPII(phoneLike) }] : []),
      ];
    }

    return this.prisma.resident.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        allocations: {
          where: { toDate: null },
          include: {
            bed: { include: { room: { include: { floor: true } } } },
          },
        },
      },
    });
  }

  async get(residentId: string, userId: string, role: UserRole) {
    const r = await this.prisma.resident.findUnique({
      where: { id: residentId },
      include: {
        allocations: {
          orderBy: { fromDate: 'desc' },
          include: { bed: { include: { room: { include: { floor: true } } } } },
        },
        payments: { orderBy: { paidOn: 'desc' }, take: 50 },
        advances: { orderBy: { paidOn: 'desc' } },
      },
    });
    if (!r) throw new NotFoundException();
    await this.assertScope(r.pgId, userId, role);
    return r;
  }

  // ── Onboard ────────────────────────────────────────────────────────────

  async onboard(
    input: OnboardResidentInput,
    userId: string,
    role: UserRole,
    meta: { ip?: string; userAgent?: string } = {},
  ) {
    await this.assertScope(input.pgId, userId, role);

    // Pre-flight checks before opening the transaction.
    const [pg, bed, existingByPhone] = await Promise.all([
      this.prisma.pG.findUnique({
        where: { id: input.pgId },
        include: { settings: true },
      }),
      this.prisma.bed.findUnique({
        where: { id: input.bedId },
        include: {
          room: { include: { floor: true, sharingType: true } },
          allocations: { where: { toDate: null } },
        },
      }),
      this.prisma.resident.findUnique({ where: { phoneHash: hashPII(input.phone) } }),
    ]);

    if (!pg) throw new NotFoundException('PG not found');
    if (!bed) throw new NotFoundException('Bed not found');
    if (bed.room.floor.pgId !== input.pgId) {
      throw new BadRequestException('Bed belongs to a different PG');
    }
    if (bed.status !== BedStatus.VACANT) throw new ConflictException('Bed is not vacant');
    if (bed.allocations.length > 0) throw new ConflictException('Bed already has an active allocation');
    if (existingByPhone) throw new ConflictException('A resident with this phone already exists');

    // Floor gender restriction
    const allowed = bed.room.floor.allowedGender;
    if (allowed !== 'ANY' && allowed !== input.gender) {
      throw new BadRequestException(`This floor accepts ${allowed} residents only`);
    }

    // Compute due day of month from joinedOn + settings.dueDaysAfterJoin
    const joined = new Date(input.joinedOn);
    const dueDays = pg.settings?.dueDaysAfterJoin ?? 3;
    const dueDayOfMonth = ((joined.getUTCDate() + dueDays - 1) % 31) + 1;

    const rent = bed.room.rentOverride ?? bed.room.sharingType.monthlyRent;

    const created = await this.prisma.$transaction(async (tx) => {
      const resident = await tx.resident.create({
        data: {
          pgId: input.pgId,
          fullName: input.fullName,
          phoneEncrypted: encryptPII(input.phone),
          phoneHash: hashPII(input.phone),
          alternatePhone: input.alternatePhone ? encryptPII(input.alternatePhone) : null,
          email: input.email,
          gender: input.gender,
          dob: input.dob ? new Date(input.dob) : null,
          photoUrl: input.photoUrl,
          idProofType: input.idProofType,
          idProofNumberHash: input.idProofNumber ? hashPII(input.idProofNumber) : null,
          idProofUrl: input.idProofUrl,

          homeAddress: input.homeAddress,
          homeCity: input.homeCity,
          homeState: input.homeState,
          primaryContactName: input.primaryContactName,
          primaryContactPhoneEncrypted: encryptPII(input.primaryContactPhone),

          workOrInstitution: input.workOrInstitution,
          workAddress: input.workAddress,

          joinedOn: joined,
          dueDayOfMonth,
          withFood: input.withFood,
          status: ResidentStatus.ACTIVE,
        },
      });

      await tx.allocation.create({
        data: {
          residentId: resident.id,
          bedId: bed.id,
          fromDate: joined,
          rentSnapshot: rent,
        },
      });

      await tx.bed.update({
        where: { id: bed.id },
        data: { status: BedStatus.OCCUPIED },
      });

      if (input.advanceAmount > 0) {
        const advanceMonths = pg.settings?.advanceMonths ?? 2;
        await tx.advance.create({
          data: {
            residentId: resident.id,
            monthsCovered: advanceMonths,
            amount: input.advanceAmount,
            paidOn: joined,
          },
        });
        await tx.payment.create({
          data: {
            residentId: resident.id,
            kind: PaymentKind.ADVANCE,
            amount: input.advanceAmount,
            paidOn: joined,
            method: input.paymentMethod as PaymentMethod,
            reference: input.paymentReference,
            recordedBy: userId,
          },
        });
      }

      if (input.firstMonthRent > 0) {
        await tx.payment.create({
          data: {
            residentId: resident.id,
            kind: PaymentKind.RENT,
            forMonth: joined.getUTCMonth() + 1,
            forYear: joined.getUTCFullYear(),
            amount: input.firstMonthRent,
            paidOn: joined,
            method: input.paymentMethod as PaymentMethod,
            reference: input.paymentReference,
            recordedBy: userId,
          },
        });
      }

      return resident;
    });

    await this.audit.record({
      userId,
      action: 'resident.onboard',
      entity: 'resident',
      entityId: created.id,
      pgId: input.pgId,
      after: { id: created.id, fullName: created.fullName, bedId: bed.id },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return created;
  }

  // ── Update (limited fields; sensitive PII re-encrypts) ────────────────

  async update(
    residentId: string,
    input: UpdateResidentInput,
    userId: string,
    role: UserRole,
    meta: { ip?: string; userAgent?: string } = {},
  ) {
    const resident = await this.prisma.resident.findUnique({ where: { id: residentId } });
    if (!resident) throw new NotFoundException();
    await this.assertScope(resident.pgId, userId, role);

    const data: Prisma.ResidentUpdateInput = {};
    if (input.fullName !== undefined) data.fullName = input.fullName;
    if (input.email !== undefined) data.email = input.email;
    if (input.homeAddress !== undefined) data.homeAddress = input.homeAddress;
    if (input.homeCity !== undefined) data.homeCity = input.homeCity;
    if (input.homeState !== undefined) data.homeState = input.homeState;
    if (input.primaryContactName !== undefined) data.primaryContactName = input.primaryContactName;
    if (input.workOrInstitution !== undefined) data.workOrInstitution = input.workOrInstitution;
    if (input.workAddress !== undefined) data.workAddress = input.workAddress;
    if (input.withFood !== undefined) data.withFood = input.withFood;
    if (input.photoUrl !== undefined) data.photoUrl = input.photoUrl;

    if (input.phone !== undefined) {
      const newHash = hashPII(input.phone);
      if (newHash !== resident.phoneHash) {
        const dup = await this.prisma.resident.findUnique({ where: { phoneHash: newHash } });
        if (dup && dup.id !== residentId) throw new ConflictException('Phone already in use');
      }
      data.phoneEncrypted = encryptPII(input.phone);
      data.phoneHash = newHash;
    }
    if (input.alternatePhone !== undefined) {
      data.alternatePhone = encryptPII(input.alternatePhone);
    }
    if (input.primaryContactPhone !== undefined) {
      data.primaryContactPhoneEncrypted = encryptPII(input.primaryContactPhone);
    }

    const updated = await this.prisma.resident.update({ where: { id: residentId }, data });

    await this.audit.record({
      userId,
      action: 'resident.update',
      entity: 'resident',
      entityId: residentId,
      pgId: resident.pgId,
      before: { fullName: resident.fullName, email: resident.email },
      after: { fullName: updated.fullName, email: updated.email },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return updated;
  }

  // ── Notice ─────────────────────────────────────────────────────────────

  async giveNotice(
    residentId: string,
    input: GiveNoticeInput,
    userId: string,
    role: UserRole,
    meta: { ip?: string; userAgent?: string } = {},
  ) {
    const r = await this.prisma.resident.findUnique({
      where: { id: residentId },
      include: { pg: { include: { settings: true } }, allocations: { where: { toDate: null } } },
    });
    if (!r) throw new NotFoundException();
    await this.assertScope(r.pgId, userId, role);
    if (r.status !== ResidentStatus.ACTIVE) throw new BadRequestException('Resident not active');

    const noticeDays = r.pg.settings?.noticeDays ?? 30;
    const expected =
      input.expectedLeavingOn ? new Date(input.expectedLeavingOn) : new Date(Date.now() + noticeDays * 86_400_000);

    const updated = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.resident.update({
        where: { id: residentId },
        data: {
          status: ResidentStatus.NOTICE,
          noticeGivenOn: new Date(),
          expectedLeavingOn: expected,
        },
      });
      for (const alloc of r.allocations) {
        await tx.bed.update({ where: { id: alloc.bedId }, data: { status: BedStatus.NOTICE_PERIOD } });
      }
      return updated;
    });

    await this.audit.record({
      userId,
      action: 'resident.notice',
      entity: 'resident',
      entityId: residentId,
      pgId: r.pgId,
      after: { expectedLeavingOn: expected.toISOString(), note: input.note },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return updated;
  }

  // ── Cancel notice ──────────────────────────────────────────────────────

  async cancelNotice(
    residentId: string,
    userId: string,
    role: UserRole,
    meta: { ip?: string; userAgent?: string } = {},
  ) {
    const r = await this.prisma.resident.findUnique({
      where: { id: residentId },
      include: { allocations: { where: { toDate: null } } },
    });
    if (!r) throw new NotFoundException();
    await this.assertScope(r.pgId, userId, role);
    if (r.status !== ResidentStatus.NOTICE) {
      throw new BadRequestException('Resident is not on notice');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.resident.update({
        where: { id: residentId },
        data: {
          status: ResidentStatus.ACTIVE,
          noticeGivenOn: null,
          expectedLeavingOn: null,
        },
      });
      for (const alloc of r.allocations) {
        await tx.bed.update({ where: { id: alloc.bedId }, data: { status: BedStatus.OCCUPIED } });
      }
      return updated;
    });

    await this.audit.record({
      userId,
      action: 'resident.cancel-notice',
      entity: 'resident',
      entityId: residentId,
      pgId: r.pgId,
      before: { status: r.status, expectedLeavingOn: r.expectedLeavingOn?.toISOString() ?? null },
      after: { status: updated.status },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return updated;
  }

  // ── Relieve ────────────────────────────────────────────────────────────

  async relieve(
    residentId: string,
    input: RelieveInput,
    userId: string,
    role: UserRole,
    meta: { ip?: string; userAgent?: string } = {},
  ) {
    const r = await this.prisma.resident.findUnique({
      where: { id: residentId },
      include: {
        allocations: { where: { toDate: null } },
        advances: true,
      },
    });
    if (!r) throw new NotFoundException();
    await this.assertScope(r.pgId, userId, role);
    if (r.status === ResidentStatus.INACTIVE) {
      throw new BadRequestException('Resident already relieved');
    }

    const leaving = new Date(input.actualLeavingOn);

    // Refund = sum(advances - already refunded) - damages
    const totalAdvance = r.advances.reduce((s, a) => s + a.amount, 0);
    const totalRefunded = r.advances.reduce((s, a) => s + a.refundedAmount, 0);
    const refundable = Math.max(0, totalAdvance - totalRefunded - input.damagesAmount);

    await this.prisma.$transaction(async (tx) => {
      // Close active allocations and free beds.
      for (const a of r.allocations) {
        await tx.allocation.update({ where: { id: a.id }, data: { toDate: leaving } });
        await tx.bed.update({ where: { id: a.bedId }, data: { status: BedStatus.VACANT } });
      }
      await tx.resident.update({
        where: { id: residentId },
        data: {
          status: ResidentStatus.INACTIVE,
          actualLeavingOn: leaving,
        },
      });
      if (refundable > 0) {
        await tx.payment.create({
          data: {
            residentId,
            kind: PaymentKind.REFUND,
            amount: refundable,
            paidOn: leaving,
            method: 'CASH',
            notes: input.notes,
            recordedBy: userId,
          },
        });
        // Distribute the refund across advances oldest-first.
        let remaining = refundable;
        for (const a of r.advances) {
          if (remaining <= 0) break;
          const left = Math.max(0, a.amount - a.refundedAmount);
          if (left <= 0) continue;
          const take = Math.min(left, remaining);
          await tx.advance.update({
            where: { id: a.id },
            data: { refundedAmount: a.refundedAmount + take, refundedOn: leaving },
          });
          remaining -= take;
        }
      }
    });

    await this.audit.record({
      userId,
      action: 'resident.relieve',
      entity: 'resident',
      entityId: residentId,
      pgId: r.pgId,
      after: { actualLeavingOn: leaving.toISOString(), refundable, damages: input.damagesAmount },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return { residentId, refundable };
  }
}
