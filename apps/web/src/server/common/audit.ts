// Audit log helper — drops PII, then writes one row to public.audit_logs.

import { createHmac } from 'node:crypto';

import { prisma } from './prisma';

export interface AuditEntry {
  userId?: string;
  action: string;       // e.g. "resident.onboard"
  entity: string;       // e.g. "resident"
  entityId?: string;
  pgId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  userAgent?: string;
}

const PII_KEYS = new Set([
  'passwordHash',
  'password',
  'phoneEncrypted',
  'phoneHash',
  'alternatePhone',
  'primaryContactPhoneEncrypted',
  'idProofUrl',
  'idProofNumberHash',
  'totpSecretEncrypted',
  'codeHash',
  'tokenHash',
]);

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (PII_KEYS.has(k)) continue;
      out[k] = sanitize(v);
    }
    return out;
  }
  return value;
}

const HMAC_KEY = process.env.PII_ENCRYPTION_KEY ?? 'fallback-not-for-prod';

function hashIp(ip: string): string {
  return createHmac('sha256', HMAC_KEY).update(ip).digest('hex').slice(0, 32);
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      pgId: entry.pgId,
      before: entry.before === undefined ? undefined : (sanitize(entry.before) as object),
      after: entry.after === undefined ? undefined : (sanitize(entry.after) as object),
      ipHash: entry.ip ? hashIp(entry.ip) : null,
      userAgent: entry.userAgent?.slice(0, 500),
    },
  });
}

/** Pull client IP and UA from a Next.js Request, for audit calls. */
export function reqMeta(req: Request): { ip?: string; userAgent?: string } {
  const xff = req.headers.get('x-forwarded-for') ?? '';
  const ip = xff.split(',')[0]?.trim() || undefined;
  const userAgent = req.headers.get('user-agent') ?? undefined;
  return { ip, userAgent };
}
