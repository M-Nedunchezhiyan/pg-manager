import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email().max(254).toLowerCase(),
  password: z.string().min(8).max(200),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const TotpCodeSchema = z.object({
  code: z
    .string()
    .min(6)
    .max(20)
    .transform((s) => s.replace(/\s/g, '')),
});
export type TotpCodeInput = z.infer<typeof TotpCodeSchema>;
