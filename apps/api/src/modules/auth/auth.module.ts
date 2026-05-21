import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { env } from '../../config/env';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DenylistService } from './denylist.service';
import { JwtStrategy } from './jwt.strategy';
import { MfaStrategy } from './mfa.strategy';
import { TokenService } from './token.service';
import { TotpService } from './totp.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt', session: false }),
    JwtModule.register({
      secret: env.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: env.JWT_ACCESS_TTL },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, TotpService, DenylistService, JwtStrategy, MfaStrategy],
  exports: [AuthService, TokenService, DenylistService],
})
export class AuthModule {}
