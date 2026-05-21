import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Request, Response } from 'express';

/**
 * Global exception filter — never leaks stack traces or internal details to clients.
 * Logs the full error server-side with a request correlation id.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const correlationId =
      (req.headers['x-request-id'] as string | undefined) ?? cryptoRandomId();

    // Log full details server-side; never to the client.
    this.logger.error({
      correlationId,
      method: req.method,
      url: req.url,
      status,
      err: exception instanceof Error ? { name: exception.name, message: exception.message, stack: exception.stack } : exception,
    });

    res.setHeader('X-Request-Id', correlationId);

    if (status >= 500) {
      res.status(status).json({
        statusCode: status,
        message: 'Internal server error',
        correlationId,
      });
      return;
    }

    res.status(status).json(
      typeof message === 'string'
        ? { statusCode: status, message, correlationId }
        : { ...((message as object) ?? {}), correlationId },
    );
  }
}

function cryptoRandomId(): string {
  return randomBytes(8).toString('hex');
}
