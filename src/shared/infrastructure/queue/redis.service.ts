import { Injectable } from '@nestjs/common';
import IORedis from 'ioredis';
import { AppLoggerService } from '../logger/logger.service';

@Injectable()
export class RedisService {
  private readonly client: IORedis;
  private readonly logger = new AppLoggerService();

  constructor() {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.client = new IORedis(url, { maxRetriesPerRequest: null });

    this.client.on('connect', () =>
      this.logger.log('Redis connecting', {
        type: 'redis',
        url: this.mask(url),
      }),
    );
    this.client.on('ready', () =>
      this.logger.log('Redis connection ready', { type: 'redis' }),
    );
    this.client.on('error', (err) =>
      this.logger.error('Redis connection error', err.stack, {
        type: 'redis',
        errorMessage: err.message,
      }),
    );
    this.client.on('close', () =>
      this.logger.warn('Redis connection closed', { type: 'redis' }),
    );
    this.client.on('reconnecting', (delayMs: number) =>
      this.logger.warn('Redis reconnecting', {
        type: 'redis',
        delayMs,
      }),
    );
    this.client.on('end', () =>
      this.logger.error(
        'Redis connection ended (no more reconnects). ' +
          'Queue operations (queue.add / worker fetch) will BLOCK forever ' +
          'because maxRetriesPerRequest=null -> probables 504 en requests que encolan',
        undefined,
        { type: 'redis' },
      ),
    );
  }

  get connection(): IORedis {
    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  private mask(url: string): string {
    return url.replace(/\/\/.*@/, '//***@');
  }
}
