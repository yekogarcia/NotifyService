import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { DEAD_LETTER_QUEUE } from '../../../../shared/infrastructure/queue/queue.module';
import { RedisService } from '../../../../shared/infrastructure/queue/redis.service';
import { AppLoggerService } from '../../../../shared/infrastructure/logger/logger.service';

@Injectable()
export class DeadLetterQueue {
  private readonly logger = new AppLoggerService();
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
    let jobId: string | number | undefined;
    try {
      const job = await this.dlq.add('dead-letter', {
        deliveryId,
        notificationId,
        reason,
        metadata,
        movedAt: new Date().toISOString(),
      });
      jobId = job.id;
    } catch (error) {
      // Si Redis está caído el delivery queda SIN rastro en la DLQ: este log
      // es el único registro de que se intentó mover.
      this.logger.error(
        'Failed to enqueue delivery to Dead Letter Queue (Redis down?)',
        error instanceof Error ? error.stack : String(error),
        { deliveryId, notificationId, reason },
      );
      throw error;
    }

    this.logger.error('Delivery moved to Dead Letter Queue', undefined, {
      deliveryId,
      notificationId,
      reason,
      jobId,
    });
  }
}
