import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Observable, tap } from 'rxjs';
import { FastifyRequest } from 'fastify';
import { AppLoggerService } from '../logger/logger.service';
import { sanitizeForLog } from './log-sanitizer';

type LoggedRequest = FastifyRequest & {
  correlationId?: string;
  startTime?: number;
  tenantId?: string;
  user?: { type?: string; sub?: string; tenantId?: string; email?: string };
};

/**
 * Registra en logs cada request HTTP que entra a un endpoint y cada
 * respuesta exitosa que sale (los errores los loguea AllExceptionsFilter).
 * Cada log lleva `correlationId` para poder unir entrada/salida/error.
 */
@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly slowRequestMs = Number(process.env.SLOW_REQUEST_MS ?? 10000);

  constructor(
    private readonly logger: AppLoggerService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<LoggedRequest>();
    const startTime = Date.now();
    req.startTime = startTime;

    const { method, url } = req;
    const correlationId =
      req.correlationId ?? (req.headers['x-correlation-id'] as string);

    this.logger.log(`--> ${method} ${url}`, {
      type: 'http_request',
      correlationId,
      method,
      url,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      tenantId: req.user?.tenantId ?? req.tenantId,
      userId: req.user?.sub,
      query: sanitizeForLog(req.query),
      params: sanitizeForLog(req.params),
      body: sanitizeForLog(req.body),
    });

    const expectedStatus =
      this.reflector.getAllAndOverride<number>(HTTP_CODE_METADATA, [
        context.getHandler(),
      ]) ?? (method === 'POST' ? 201 : 200);

    return next.handle().pipe(
      tap((data) => {
        const durationMs = Date.now() - startTime;
        const logContext: Record<string, unknown> = {
          type: 'http_response',
          correlationId,
          method,
          url,
          statusCode: expectedStatus,
          durationMs,
          data: sanitizeForLog(data),
        };

        if (durationMs >= this.slowRequestMs) {
          this.logger.warn(
            `<-- ${method} ${url} ${expectedStatus} SLOW ${durationMs}ms`,
            logContext,
          );
        } else {
          this.logger.log(
            `<-- ${method} ${url} ${expectedStatus} ${durationMs}ms`,
            logContext,
          );
        }
      }),
    );
  }
}
