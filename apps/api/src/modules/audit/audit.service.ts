import { createHmac } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { env } from '../../config/env';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  userId?: string | undefined;
  action: string;             // e.g. "resident.create"
  entity: string;             // e.g. "resident"
  entityId?: string | undefined;
  pgId?: string | undefined;
  before?: unknown;
  after?: unknown;
  ip?: string | undefined;
  userAgent?: string | undefined;
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

/** Drop PII / hashes / tokens before serializing into the audit log. */
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

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        pgId: entry.pgId,
        before: entry.before === undefined ? undefined : (sanitize(entry.before) as object),
        after: entry.after === undefined ? undefined : (sanitize(entry.after) as object),
        ipHash: entry.ip ? this.hashIp(entry.ip) : null,
        userAgent: entry.userAgent?.slice(0, 500),
      },
    });
  }

  private hashIp(ip: string): string {
    return createHmac('sha256', env.JWT_ACCESS_SECRET).update(ip).digest('hex').slice(0, 32);
  }
}
