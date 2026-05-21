import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { UserRole } from '@pg/db';

export interface RequestUser {
  sub: string;
  role: UserRole;
  email: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as RequestUser;
  },
);
