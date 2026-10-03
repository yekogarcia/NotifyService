import { Injectable } from '@nestjs/common';
import IORedis from 'ioredis';
import { AppLoggerService } from '../logger/logger.service';

@Injectable()
export class RedisService {
  private readonly client: IORedis;
  private readonly logger = new AppLoggerService();

  constructor() {
    const { host, port, password } = this.resolveConnection();
    this.client = new IORedis({
      host,
      port,
      password,
      maxRetriesPerRequest: null,
    });

    this.client.on('ready', () =>
      this.logger.log('Redis connection ready', { type: 'redis' }),
    );
    this.client.on('error', (err) =>
      this.logger.error('Redis connection error', err.stack, {
        type: 'redis',
      }),
    );
    this.client.on('reconnecting', (delayMs: number) =>
      this.logger.warn('Redis reconnecting', { type: 'redis', delayMs }),
    );
    this.client.on('end', () =>
      this.logger.error(
        'Redis connection ended (no more reconnects). Queue operations will block forever',
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

  private resolveConnection(): {
    host: string;
    port: number;
    password?: string;
  } {
    const password = process.env.REDIS_PASS || undefined;

    if (process.env.REDIS_HOST) {
      return {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
        password,
      };
    }

    const url = process.env.REDIS_URL;
    if (url) {
      const clean = url
        .replace(/^rediss?:\/\//, '')
        .replace(/^[^@/]*@/, '')
        .replace(/\/.*$/, '');
      const [host, port] = clean.split(':');
      if (host) {
        return { host, port: parseInt(port ?? '6379', 10), password };
      }
    }

    return { host: 'localhost', port: 6379, password };
  }
}
