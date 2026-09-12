import { Injectable } from '@nestjs/common';
import IORedis from 'ioredis';

@Injectable()
export class RedisService {
  private readonly client: IORedis;

  constructor() {
    this.client = new IORedis(
      process.env.REDIS_URL ?? 'redis://localhost:6379',
      { maxRetriesPerRequest: null },
    );
  }

  get connection(): IORedis {
    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
