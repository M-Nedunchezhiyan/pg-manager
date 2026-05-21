import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '@pg/db';

import { PrismaService } from '../../modules/prisma/prisma.service';

/**
 * RBAC guard that enforces row-level access:
 *  - OWNER: full access.
 *  - MANAGER: must have a UserPGScope row for the pgId in the request.
 *
 * The guarded route must expose `pgId` via params, query, or body.
 */
@Injectable()
export class PGScopeGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as { sub: string; role: UserRole } | undefined;
    if (!user) throw new ForbiddenException('No user context');
    if (user.role === UserRole.OWNER) return true;

    const pgId =
      req.params?.pgId ?? req.body?.pgId ?? req.query?.pgId;
    if (!pgId || typeof pgId !== 'string') {
      throw new ForbiddenException('pgId required for scoped access');
    }

    const scope = await this.prisma.userPGScope.findUnique({
      where: { userId_pgId: { userId: user.sub, pgId } },
    });
    if (!scope) throw new ForbiddenException('No access to this PG');
    return true;
  }
}
