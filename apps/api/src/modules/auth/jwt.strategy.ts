import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { env } from '../../config/env';
import { ACCESS_COOKIE, unwrap } from './cookies';
import { DenylistService } from './denylist.service';

export interface JwtPayload {
  sub: string;
  role: 'OWNER' | 'MANAGER';
  email: string;
  jti: string;
  iat: number;
  exp: number;
  purpose?: 'access' | 'mfa';
}

/** Extract a wrapped access cookie and unwrap it before letting passport-jwt verify. */
function fromCookie(req: Request): string | null {
  const wrapped = req.cookies?.[ACCESS_COOKIE] as string | undefined;
  return unwrap(wrapped) ?? null;
}

/** Bearer headers are accepted ALSO wrapped (for Postman/Swagger users) — unwrap if possible. */
function fromBearer(req: Request): string | null {
  const raw = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
  if (!raw) return null;
  return unwrap(raw) ?? raw;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly denylist: DenylistService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([fromCookie, fromBearer]),
      ignoreExpiration: false,
      secretOrKey: env.JWT_ACCESS_SECRET,
      passReqToCallback: false,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (!payload?.sub || !payload?.jti) throw new UnauthorizedException();
    if (payload.purpose && payload.purpose !== 'access') {
      throw new UnauthorizedException('Wrong token type');
    }
    if (await this.denylist.isJtiDenied(payload.jti)) {
      throw new UnauthorizedException('Token revoked');
    }
    const cutoff = await this.denylist.getUserCutoff(payload.sub);
    if (cutoff && payload.iat < cutoff) {
      throw new UnauthorizedException('Session invalidated');
    }
    return payload;
  }
}
