import { z } from 'zod';

// Shared Zod schemas — used by both api (validation) and web (forms).

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?\d{10,15}$/, 'Phone must be 10–15 digits');

export const pincodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Pincode must be 6 digits');

export const pgCreateSchema = z.object({
  name: z.string().min(2).max(100),
  type: z.enum(['MALE', 'FEMALE', 'COED']),
  address: z.string().min(5).max(500),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  pincode: pincodeSchema,
  phone: phoneSchema.optional(),
});
export type PGCreateInput = z.infer<typeof pgCreateSchema>;

export const residentOnboardSchema = z.object({
  pgId: z.string().cuid(),
  fullName: z.string().min(2).max(100),
  phone: phoneSchema,
  alternatePhone: phoneSchema.optional(),
  email: z.string().email().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'ANY']),
  dob: z.string().date().optional(),

  homeAddress: z.string().min(5).max(500),
  homeCity: z.string().min(2).max(100),
  homeState: z.string().min(2).max(100),
  primaryContactName: z.string().min(2).max(100),
  primaryContactPhone: phoneSchema,
  workOrInstitution: z.string().min(2).max(200),
  workAddress: z.string().max(500).optional(),

  joinedOn: z.string().date(),
  withFood: z.boolean(),
  bedId: z.string().cuid(),

  idProofType: z.enum(['AADHAAR', 'PAN', 'LICENSE', 'PASSPORT', 'OTHER']).optional(),
  idProofNumber: z.string().min(4).max(50).optional(),
});
export type ResidentOnboardInput = z.infer<typeof residentOnboardSchema>;

export const paymentRecordSchema = z.object({
  residentId: z.string().cuid(),
  kind: z.enum(['RENT', 'ADVANCE', 'LATE_FEE', 'REFUND', 'ADJUSTMENT']),
  forMonth: z.number().int().min(1).max(12).optional(),
  forYear: z.number().int().min(2020).max(2100).optional(),
  amount: z.number().int().positive(), // paise
  paidOn: z.string().date(),
  method: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'OTHER']),
  reference: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});
export type PaymentRecordInput = z.infer<typeof paymentRecordSchema>;
