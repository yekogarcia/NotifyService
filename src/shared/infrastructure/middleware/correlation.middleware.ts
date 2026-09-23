import { Injectable, NestMiddleware } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { ServerResponse } from 'http';
import { randomUUID } from 'crypto';

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: FastifyRequest, res: ServerResponse, next: () => void): void {
    const correlationId =
      (req.headers['x-correlation-id'] as string) ?? randomUUID();

    req.headers['x-correlation-id'] = correlationId;
    res.setHeader('X-Correlation-Id', correlationId);

    (req as unknown as Record<string, unknown>).correlationId = correlationId;

    next();
  }
}
