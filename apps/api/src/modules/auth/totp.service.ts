import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { authenticator } from '@otplib/preset-default';
import QRCode from 'qrcode';

import { decryptPII, encryptPII } from '../../common/crypto/pii';
import { PrismaService } from '../prisma/prisma.service';

// 30-second window, 6-digit codes, allow ±1 step to tolerate clock drift.
authenticator.options = { step: 30, digits: 6, window: 1 };

const ISSUER = 'PG Manager';
const BACKUP_CODE_COUNT = 10;

@Injectable()
export class TotpService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a fresh secret + provisioning URI + QR data URL.
   * Stored encrypted (PII_ENCRYPTION_KEY). Not enabled until /2fa/enable succeeds.
   */
  async beginEnrollment(userId: string, email: string): Promise<{ qrDataUrl: string; otpauthUrl: string }> {
    const secret = authenticator.generateSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecretEncrypted: encryptPII(secret), totpEnabled: false },
    });

    const otpauthUrl = authenticator.keyuri(email, ISSUER, secret);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { errorCorrectionLevel: 'M' });
    return { qrDataUrl, otpauthUrl };
  }

  /**
   * Finalize enrollment: verify the user can compute valid codes from the secret,
   * then mark totpEnabled and issue one-time backup codes (plaintext returned once,
   * sha256 stored).
   */
  async confirmEnrollment(userId: string, code: string): Promise<{ backupCodes: string[] }> {
    const ok = await this.verifyCode(userId, code);
    if (!ok) throw new UnauthorizedException('Invalid TOTP code');

    // Wipe existing backup codes and reissue.
    await this.prisma.totpBackupCode.deleteMany({ where: { userId } });
    const plain: string[] = [];
    const rows: Array<{ userId: string; codeHash: string }> = [];
    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
      const code = randomBytes(5).toString('hex'); // 10 hex chars
      plain.push(code);
      rows.push({ userId, codeHash: this.hashBackup(code) });
    }
    await this.prisma.totpBackupCode.createMany({ data: rows });
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: true, totpEnrolledAt: new Date() },
    });

    return { backupCodes: plain };
  }

  async disable(userId: string, code: string): Promise<void> {
    const ok = await this.verifyCode(userId, code);
    if (!ok) throw new UnauthorizedException('Invalid TOTP code');
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: false, totpSecretEncrypted: null, totpEnrolledAt: null },
    });
    await this.prisma.totpBackupCode.deleteMany({ where: { userId } });
  }

  /** Verify a 6-digit TOTP code OR a single-use backup code (one of `\d{2}-[a-f0-9]{10}`). */
  async verifyCodeOrBackup(userId: string, code: string): Promise<boolean> {
    if (/^[a-f0-9]{10}$/i.test(code.replace(/[\s-]/g, ''))) {
      return this.consumeBackupCode(userId, code.replace(/[\s-]/g, '').toLowerCase());
    }
    return this.verifyCode(userId, code);
  }

  // ── internals ──────────────────────────────────────────────────────────

  private async verifyCode(userId: string, code: string): Promise<boolean> {
    if (!/^\d{6}$/.test(code)) return false;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpSecretEncrypted) return false;
    const secret = decryptPII(user.totpSecretEncrypted);
    try {
      return authenticator.verify({ token: code, secret });
    } catch {
      return false;
    }
  }

  private async consumeBackupCode(userId: string, plainCode: string): Promise<boolean> {
    const hash = this.hashBackup(plainCode);
    const row = await this.prisma.totpBackupCode.findUnique({
      where: { userId_codeHash: { userId, codeHash: hash } },
    });
    if (!row || row.usedAt) return false;

    // Mark used. If two requests race, only one will set usedAt thanks to updateMany count.
    const upd = await this.prisma.totpBackupCode.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    return upd.count === 1;
  }

  private hashBackup(plain: string): string {
    return createHash('sha256').update(plain).digest('hex');
  }

  /** Constant-time compare helper exported for tests. */
  static safeEq(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  }
}
