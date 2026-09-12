import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';

export const NOTIFICATION_QUEUE = 'notification-queue';
export const RETRY_QUEUE = 'retry-queue';
export const DEAD_LETTER_QUEUE = 'dead-letter-queue';

@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class QueueModule {}
