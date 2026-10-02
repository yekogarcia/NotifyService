import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { QueryFailedError } from 'typeorm';
import { AppLoggerService } from '../logger/logger.service';
import { sanitizeForLog } from './log-sanitizer';

type LoggedRequest = FastifyRequest & {
  correlationId?: string;
  startTime?: number;
};

interface ErrorDescription {
  statusCode: number;
  error: string;
  /** Mensaje que se envía al cliente. */
  clientMessage: string | string[];
  /** Mensaje real que se registra en logs. */
  logMessage: string;
  details?: Record<string, unknown>;
}

/**
 * Filtro global: atrapa TODAS las excepciones (HttpException, errores de
 * TypeORM, errores de Fastify y cualquier error no controlado), las pinta
 * en logs con correlationId, body de la request, stack trace y la respuesta
 * exacta que se envía al cliente.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      // Contextos no-HTTP (workers, etc.): solo loguear.
      this.logger.error(
        'Unhandled exception outside HTTP context',
        exception instanceof Error ? exception.stack : String(exception),
        { type: 'unhandled_exception' },
      );
      return;
    }

    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const req = ctx.getRequest<LoggedRequest>();

    const desc = this.describe(exception);
    const correlationId =
      req.correlationId ?? (req.headers['x-correlation-id'] as string);
    const durationMs = req.startTime ? Date.now() - req.startTime : undefined;

    const responseBody: Record<string, unknown> = {
      statusCode: desc.statusCode,
      error: desc.error,
      message: desc.clientMessage,
      correlationId,
      path: req.url,
      timestamp: new Date().toISOString(),
    };

    this.logger.error(
      `<-- ${req.method} ${req.url} ${desc.statusCode} ${desc.error}: ${desc.logMessage}`,
      exception instanceof Error ? exception.stack : String(exception),
      {
        type: 'http_exception',
        correlationId,
        method: req.method,
        url: req.url,
        statusCode: desc.statusCode,
        error: desc.error,
        durationMs,
        ip: req.ip,
        query: sanitizeForLog(req.query),
        params: sanitizeForLog(req.params),
        body: sanitizeForLog(req.body),
        responseBody,
        ...desc.details,
      },
    );

    if (!reply.sent) {
      void reply.code(desc.statusCode).send(responseBody);
    }
  }

  private describe(exception: unknown): ErrorDescription {
    // Errores HTTP de NestJS (BadRequestException, NotFoundException, etc.)
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'string') {
        return {
          statusCode,
          error: exception.name,
          clientMessage: response,
          logMessage: response,
        };
      }

      if (typeof response === 'object' && response !== null) {
        const body = response as Record<string, unknown>;
        const message = (body.message ?? exception.message) as
          string | string[];
        return {
          statusCode,
          error: (body.error as string) ?? exception.name,
          clientMessage: message,
          logMessage: Array.isArray(message)
            ? message.join('; ')
            : String(message),
        };
      }

      return {
        statusCode,
        error: exception.name,
        clientMessage: exception.message,
        logMessage: exception.message,
      };
    }

    // Errores de base de datos (TypeORM / Postgres)
    if (exception instanceof QueryFailedError) {
      const driverError = exception.driverError as
        { code?: string; detail?: string } | undefined;
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'DatabaseError',
        clientMessage: 'Internal server error',
        logMessage: `Database query failed: ${exception.message}`,
        details: {
          pgCode: driverError?.code,
          pgDetail: driverError?.detail,
          query: sanitizeForLog(exception.query),
        },
      };
    }

    // Errores de Fastify (body inválido, payload muy grande, etc.)
    const err = exception as {
      statusCode?: unknown;
      name?: unknown;
      message?: unknown;
      code?: unknown;
    };
    if (typeof err?.statusCode === 'number' && err.statusCode >= 400) {
      return {
        statusCode: err.statusCode,
        error: String(err.name ?? 'Error'),
        clientMessage: String(err.message ?? 'Request error'),
        logMessage: String(err.message ?? 'Request error'),
        details: { fastifyCode: err.code as string | undefined },
      };
    }

    // Cualquier otro error no controlado -> 500
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'InternalServerError',
      clientMessage: 'Internal server error',
      logMessage:
        exception instanceof Error ? exception.message : String(exception),
      details: { exceptionName: err?.name as string | undefined },
    };
  }
}
