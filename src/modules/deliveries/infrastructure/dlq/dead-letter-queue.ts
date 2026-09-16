import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { DEAD_LETTER_QUEUE } from '../../../../shared/infrastructure/queue/queue.module';
import { RedisService } from '../../../../shared/infrastructure/queue/redis.service';

@Injectable()
export class DeadLetterQueue {
  private readonly logger = new Logger(DeadLetterQueue.name);
  private readonly dlq: Queue;

  constructor(redisService: RedisService) {
    this.dlq = new Queue(DEAD_LETTER_QUEUE, {
      connection: redisService.connection,
    });
  }

  async moveToDLQ(
    deliveryId: string,
    notificationId: string,
    reason: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.dlq.add('dead-letter', {
      deliveryId,
      notificationId,
      reason,
      metadata,
      movedAt: new Date().toISOString(),
    });

    this.logger.error(
      `Delivery ${deliveryId} moved to Dead Letter Queue`,
      { notificationId, reason },
    );
  }
}
