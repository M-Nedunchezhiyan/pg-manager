import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';

/**
 * Light interceptor that flags mutating requests for downstream audit logging.
 * The actual AuditLog row is written by services (so we have the entity diff),
 * not here — this just stamps request metadata onto the request object.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    const start = Date.now();
    const mutating = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method);

    if (mutating) {
      req.audit = {
        method: req.method,
        path: req.path,
        userAgent: req.headers['user-agent']?.slice(0, 500),
      };
    }

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          if (mutating || ms > 1000) {
            this.logger.log(`${req.method} ${req.path} → ${ms}ms`);
          }
        },
      }),
    );
  }
}
