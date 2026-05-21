import { z } from 'zod';

const phone = z.string().trim().regex(/^\+?\d{10,15}$/, 'Phone must be 10–15 digits');

export const OnboardResidentSchema = z.object({
  pgId: z.string().cuid(),
  bedId: z.string().cuid(),

  // Personal
  fullName: z.string().min(2).max(100),
  phone,
  alternatePhone: phone.optional(),
  email: z.string().email().max(254).toLowerCase().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'ANY']),
  dob: z.string().date().optional(),
  photoUrl: z.string().url().max(2000).optional(),

  // ID proof
  idProofType: z.enum(['AADHAAR', 'PAN', 'LICENSE', 'PASSPORT', 'OTHER']).optional(),
  idProofNumber: z.string().min(4).max(50).optional(),
  idProofUrl: z.string().url().max(2000).optional(),

  // Home + emergency contact
  homeAddress: z.string().min(5).max(500),
  homeCity: z.string().min(2).max(100),
  homeState: z.string().min(2).max(100),
  primaryContactName: z.string().min(2).max(100),
  primaryContactPhone: phone,

  // Work / institution
  workOrInstitution: z.string().min(2).max(200),
  workAddress: z.string().max(500).optional(),

  // Stay
  joinedOn: z.string().date(),
  withFood: z.boolean(),

  // Payment captured at onboarding
  advanceAmount: z.number().int().min(0),       // paise; client computes from settings × monthlyRent
  firstMonthRent: z.number().int().min(0),      // paise; usually = monthlyRent
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
  photoUrl: z.string().url().max(2000).optional(),
});
export type UpdateResidentInput = z.infer<typeof UpdateResidentSchema>;

export const GiveNoticeSchema = z.object({
  expectedLeavingOn: z.string().date().optional(),  // server computes from settings.noticeDays if absent
  note: z.string().max(500).optional(),
});
export type GiveNoticeInput = z.infer<typeof GiveNoticeSchema>;

export const RelieveSchema = z.object({
  actualLeavingOn: z.string().date(),
  damagesAmount: z.number().int().min(0).default(0),
  notes: z.string().max(1000).optional(),
});
export type RelieveInput = z.infer<typeof RelieveSchema>;
