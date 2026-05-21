import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { env } from '../../config/env';
import { MFA_PENDING_COOKIE, unwrap } from './cookies';
import { DenylistService } from './denylist.service';
import type { JwtPayload } from './jwt.strategy';

function fromMfaCookie(req: Request): string | null {
  const wrapped = req.cookies?.[MFA_PENDING_COOKIE] as string | undefined;
  return unwrap(wrapped) ?? null;
}

/**
 * Validates `purpose: 'mfa'` tokens only; the cookie value is unwrapped from
 * the shared cipher before passport-jwt verifies it.
 */
@Injectable()
export class MfaStrategy extends PassportStrategy(Strategy, 'mfa') {
  constructor(private readonly denylist: DenylistService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([fromMfaCookie]),
      ignoreExpiration: false,
      secretOrKey: env.JWT_ACCESS_SECRET,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (payload?.purpose !== 'mfa') throw new UnauthorizedException('Not an MFA token');
    if (!payload.sub || !payload.jti) throw new UnauthorizedException();
    if (await this.denylist.isJtiDenied(payload.jti)) {
      throw new UnauthorizedException('Token revoked');
    }
    return payload;
  }
}
