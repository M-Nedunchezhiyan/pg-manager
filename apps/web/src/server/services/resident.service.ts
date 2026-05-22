// Ported from apps/api/src/modules/resident/resident.service.ts.
// Same behaviour, framework-agnostic: takes prisma + audit by import, no NestJS DI.

import {
  BedStatus,
  PaymentKind,
  type PaymentMethod,
  Prisma,
  ResidentStatus,
  UserRole,
} from '@pg/db';
import { z } from 'zod';

import { recordAudit } from '@/server/common/audit';
import { encryptPII, hashPII } from '@/server/common/pii';
import { prisma } from '@/server/common/prisma';
import { assertPgScope } from '@/server/common/scope';
import { HttpError } from '@/server/common/session';

// ── Schemas (copied from resident.dto.ts) ────────────────────────────────

const phone = z.string().trim().regex(/^\+?\d{10,15}$/, 'Phone must be 10–15 digits');

export const OnboardResidentSchema = z.object({
  pgId: z.string().cuid(),
  bedId: z.string().cuid(),
  fullName: z.string().min(2).max(100),
  phone,
  alternatePhone: phone.optional(),
  email: z.string().email().max(254).toLowerCase().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'ANY']),
  dob: z.string().date().optional(),
  photoUrl: z.string().max(2000).optional(),
  idProofType: z.enum(['AADHAAR', 'PAN', 'LICENSE', 'PASSPORT', 'OTHER']).optional(),
  idProofNumber: z.string().min(4).max(50).optional(),
  idProofUrl: z.string().max(2000).optional(),
  homeAddress: z.string().min(5).max(500),
  homeCity: z.string().min(2).max(100),
  homeState: z.string().min(2).max(100),
  primaryContactName: z.string().min(2).max(100),
  primaryContactPhone: phone,
  workOrInstitution: z.string().min(2).max(200),
  workAddress: z.string().max(500).optional(),
  joinedOn: z.string().date(),
  withFood: z.boolean(),
  advanceAmount: z.number().int().min(0),
  firstMonthRent: z.number().int().min(0),
  paymentMethod: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'OTHER']),
  paymentReference: z.string().max(100).optional(),
});
export type OnboardResidentInput = z.infer<typeof OnboardResidentSchema>;

export const UpdateResidentSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  phone: phone.optional(),
  alternatePhone: phone.optional(),
  email: z.string().email().max(254).optional(),
  homeAddress: z.string().min(5).max(500).optional(),
  homeCity: z.string().min(2).max(100).optional(),
  homeState: z.string().min(2).max(100).optional(),
  primaryContactName: z.string().min(2).max(100).optional(),
  primaryContactPhone: phone.optional(),
  workOrInstitution: z.string().min(2).max(200).optional(),
  workAddress: z.string().max(500).optional(),
  withFood: z.boolean().optional(),
  photoUrl: z.string().max(2000).optional(),
});
export type UpdateResidentInput = z.infer<typeof UpdateResidentSchema>;

export const GiveNoticeSchema = z.object({
  expectedLeavingOn: z.string().date().optional(),
  note: z.string().max(500).optional(),
});
export type GiveNoticeInput = z.infer<typeof GiveNoticeSchema>;

export const RelieveSchema = z.object({
  actualLeavingOn: z.string().date(),
  damagesAmount: z.number().int().min(0).default(0),
  notes: z.string().max(1000).optional(),
});
export type RelieveInput = z.infer<typeof RelieveSchema>;

// ── List + search ────────────────────────────────────────────────────────

export async function listResidents(
  pgId: string,
  userId: string,
  role: UserRole,
  opts: { search?: string; status?: ResidentStatus | 'ALL' } = {},
) {
  await assertPgScope(pgId, userId, role);
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

  return prisma.resident.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      allocations: {
        where: { toDate: null },
        include: { bed: { include: { room: { include: { floor: true } } } } },
      },
    },
  });
}

export async function getResident(residentId: string, userId: string, role: UserRole) {
  const r = await prisma.resident.findUnique({
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
  if (!r) throw new HttpError(404, 'Resident not found');
  await assertPgScope(r.pgId, userId, role);
  return r;
}

// ── Onboard ──────────────────────────────────────────────────────────────

export async function onboardResident(
  input: OnboardResidentInput,
  userId: string,
  role: UserRole,
  meta: { ip?: string; userAgent?: string } = {},
) {
  await assertPgScope(input.pgId, userId, role);

  const [pg, bed, existingByPhone] = await Promise.all([
    prisma.pG.findUnique({ where: { id: input.pgId }, include: { settings: true } }),
    prisma.bed.findUnique({
      where: { id: input.bedId },
      include: {
        room: { include: { floor: true, sharingType: true } },
        allocations: { where: { toDate: null } },
      },
    }),
    prisma.resident.findUnique({ where: { phoneHash: hashPII(input.phone) } }),
  ]);

  if (!pg) throw new HttpError(404, 'PG not found');
  if (!bed) throw new HttpError(404, 'Bed not found');
  if (bed.room.floor.pgId !== input.pgId) throw new HttpError(400, 'Bed belongs to a different PG');
  if (bed.status !== BedStatus.VACANT) throw new HttpError(409, 'Bed is not vacant');
  if (bed.allocations.length > 0) throw new HttpError(409, 'Bed already has an active allocation');
  if (existingByPhone) throw new HttpError(409, 'A resident with this phone already exists');

  const allowed = bed.room.floor.allowedGender;
  if (allowed !== 'ANY' && allowed !== input.gender) {
    throw new HttpError(400, `This floor accepts ${allowed} residents only`);
  }

  const joined = new Date(input.joinedOn);
  const dueDays = pg.settings?.dueDaysAfterJoin ?? 3;
  const dueDayOfMonth = ((joined.getUTCDate() + dueDays - 1) % 31) + 1;
  const rent = bed.room.rentOverride ?? bed.room.sharingType.monthlyRent;

  const created = await prisma.$transaction(async (tx) => {
    const resident = await tx.resident.create({
      data: {
        pgId: input.pgId,
        fullName: input.fullName,
        phoneEncrypted: encryptPII(input.phone),
        phoneHash: hashPII(input.phone),
        alternatePhone: input.alternatePhone ? encryptPII(input.alternatePhone) : null,
        email: input.email ?? null,
        gender: input.gender,
        dob: input.dob ? new Date(input.dob) : null,
        photoUrl: input.photoUrl ?? null,
        idProofType: input.idProofType ?? null,
        idProofNumberHash: input.idProofNumber ? hashPII(input.idProofNumber) : null,
        idProofUrl: input.idProofUrl ?? null,
        homeAddress: input.homeAddress,
        homeCity: input.homeCity,
        homeState: input.homeState,
        primaryContactName: input.primaryContactName,
        primaryContactPhoneEncrypted: encryptPII(input.primaryContactPhone),
        workOrInstitution: input.workOrInstitution,
        workAddress: input.workAddress ?? null,
        joinedOn: joined,
        dueDayOfMonth,
        withFood: input.withFood,
        status: ResidentStatus.ACTIVE,
      },
    });

    await tx.allocation.create({
      data: { residentId: resident.id, bedId: bed.id, fromDate: joined, rentSnapshot: rent },
    });

    await tx.bed.update({ where: { id: bed.id }, data: { status: BedStatus.OCCUPIED } });

    if (input.advanceAmount > 0) {
      const advanceMonths = pg.settings?.advanceMonths ?? 2;
      await tx.advance.create({
        data: { residentId: resident.id, monthsCovered: advanceMonths, amount: input.advanceAmount, paidOn: joined },
      });
      await tx.payment.create({
        data: {
          residentId: resident.id,
          kind: PaymentKind.ADVANCE,
          amount: input.advanceAmount,
          paidOn: joined,
          method: input.paymentMethod as PaymentMethod,
          reference: input.paymentReference ?? null,
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
          reference: input.paymentReference ?? null,
          recordedBy: userId,
        },
      });
    }

    return resident;
  });

  await recordAudit({
    userId,
    action: 'resident.onboard',
    entity: 'resident',
    entityId: created.id,
    pgId: input.pgId,
    after: { id: created.id, fullName: created.fullName, bedId: bed.id },
    ...meta,
  });

  return created;
}

// ── Update ───────────────────────────────────────────────────────────────

export async function updateResident(
  residentId: string,
  input: UpdateResidentInput,
  userId: string,
  role: UserRole,
  meta: { ip?: string; userAgent?: string } = {},
) {
  const resident = await prisma.resident.findUnique({ where: { id: residentId } });
  if (!resident) throw new HttpError(404, 'Resident not found');
  await assertPgScope(resident.pgId, userId, role);

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
      const dup = await prisma.resident.findUnique({ where: { phoneHash: newHash } });
      if (dup && dup.id !== residentId) throw new HttpError(409, 'Phone already in use');
    }
    data.phoneEncrypted = encryptPII(input.phone);
    data.phoneHash = newHash;
  }
  if (input.alternatePhone !== undefined) data.alternatePhone = encryptPII(input.alternatePhone);
  if (input.primaryContactPhone !== undefined) data.primaryContactPhoneEncrypted = encryptPII(input.primaryContactPhone);

  const updated = await prisma.resident.update({ where: { id: residentId }, data });

  await recordAudit({
    userId,
    action: 'resident.update',
    entity: 'resident',
    entityId: residentId,
    pgId: resident.pgId,
    before: { fullName: resident.fullName, email: resident.email },
    after: { fullName: updated.fullName, email: updated.email },
    ...meta,
  });
  return updated;
}

// ── Notice / cancel notice / relieve ─────────────────────────────────────

export async function giveResidentNotice(
  residentId: string,
  input: GiveNoticeInput,
  userId: string,
  role: UserRole,
  meta: { ip?: string; userAgent?: string } = {},
) {
  const r = await prisma.resident.findUnique({
    where: { id: residentId },
    include: { pg: { include: { settings: true } }, allocations: { where: { toDate: null } } },
  });
  if (!r) throw new HttpError(404, 'Resident not found');
  await assertPgScope(r.pgId, userId, role);
  if (r.status !== ResidentStatus.ACTIVE) throw new HttpError(400, 'Resident not active');

  const noticeDays = r.pg.settings?.noticeDays ?? 30;
  const expected = input.expectedLeavingOn
    ? new Date(input.expectedLeavingOn)
    : new Date(Date.now() + noticeDays * 86_400_000);

  const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.resident.update({
      where: { id: residentId },
      data: { status: ResidentStatus.NOTICE, noticeGivenOn: new Date(), expectedLeavingOn: expected },
    });
    for (const alloc of r.allocations) {
      await tx.bed.update({ where: { id: alloc.bedId }, data: { status: BedStatus.NOTICE_PERIOD } });
    }
    return updated;
  });

  await recordAudit({
    userId,
    action: 'resident.notice',
    entity: 'resident',
    entityId: residentId,
    pgId: r.pgId,
    after: { expectedLeavingOn: expected.toISOString(), note: input.note },
    ...meta,
  });
  return updated;
}

export async function cancelResidentNotice(
  residentId: string,
  userId: string,
  role: UserRole,
  meta: { ip?: string; userAgent?: string } = {},
) {
  const r = await prisma.resident.findUnique({
    where: { id: residentId },
    include: { allocations: { where: { toDate: null } } },
  });
  if (!r) throw new HttpError(404, 'Resident not found');
  await assertPgScope(r.pgId, userId, role);
  if (r.status !== ResidentStatus.NOTICE) throw new HttpError(400, 'Resident is not on notice');

  const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.resident.update({
      where: { id: residentId },
      data: { status: ResidentStatus.ACTIVE, noticeGivenOn: null, expectedLeavingOn: null },
    });
    for (const alloc of r.allocations) {
      await tx.bed.update({ where: { id: alloc.bedId }, data: { status: BedStatus.OCCUPIED } });
    }
    return updated;
  });

  await recordAudit({
    userId,
    action: 'resident.cancel-notice',
    entity: 'resident',
    entityId: residentId,
    pgId: r.pgId,
    before: { status: r.status, expectedLeavingOn: r.expectedLeavingOn?.toISOString() ?? null },
    after: { status: updated.status },
    ...meta,
  });
  return updated;
}

export async function relieveResident(
  residentId: string,
  input: RelieveInput,
  userId: string,
  role: UserRole,
  meta: { ip?: string; userAgent?: string } = {},
) {
  const r = await prisma.resident.findUnique({
    where: { id: residentId },
    include: { allocations: { where: { toDate: null } }, advances: true },
  });
  if (!r) throw new HttpError(404, 'Resident not found');
  await assertPgScope(r.pgId, userId, role);
  if (r.status === ResidentStatus.INACTIVE) throw new HttpError(400, 'Resident already relieved');

  const leaving = new Date(input.actualLeavingOn);
  const totalAdvance = r.advances.reduce((s, a) => s + a.amount, 0);
  const totalRefunded = r.advances.reduce((s, a) => s + a.refundedAmount, 0);
  const refundable = Math.max(0, totalAdvance - totalRefunded - input.damagesAmount);

  await prisma.$transaction(async (tx) => {
    for (const a of r.allocations) {
      await tx.allocation.update({ where: { id: a.id }, data: { toDate: leaving } });
      await tx.bed.update({ where: { id: a.bedId }, data: { status: BedStatus.VACANT } });
    }
    await tx.resident.update({
      where: { id: residentId },
      data: { status: ResidentStatus.INACTIVE, actualLeavingOn: leaving },
    });
    if (refundable > 0) {
      await tx.payment.create({
        data: {
          residentId,
          kind: PaymentKind.REFUND,
          amount: refundable,
          paidOn: leaving,
          method: 'CASH',
          notes: input.notes ?? null,
          recordedBy: userId,
        },
      });
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

  await recordAudit({
    userId,
    action: 'resident.relieve',
    entity: 'resident',
    entityId: residentId,
    pgId: r.pgId,
    after: { actualLeavingOn: leaving.toISOString(), refundable, damages: input.damagesAmount },
    ...meta,
  });

  return { residentId, refundable };
}
