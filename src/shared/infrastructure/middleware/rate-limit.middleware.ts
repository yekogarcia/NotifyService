import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { ServerResponse } from 'http';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly limits = new Map<string, RateLimitEntry>();
  private readonly windowMs = 60000;
  private readonly maxRequests = parseInt(
    process.env.RATE_LIMIT_PER_MINUTE ?? '100',
    10,
  );

  use(req: FastifyRequest, res: ServerResponse, next: () => void): void {
    const key = req.ip ?? 'unknown';
    const now = Date.now();

    let entry = this.limits.get(key);

    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + this.windowMs };
      this.limits.set(key, entry);
    }

    entry.count++;

    if (entry.count > this.maxRequests) {
      throw new HttpException(
        `Rate limit exceeded. Try again in ${Math.ceil((entry.resetAt - now) / 1000)}s`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    res.setHeader('X-RateLimit-Limit', String(this.maxRequests));
    res.setHeader(
      'X-RateLimit-Remaining',
      String(Math.max(0, this.maxRequests - entry.count)),
    );

    next();
  }
}
