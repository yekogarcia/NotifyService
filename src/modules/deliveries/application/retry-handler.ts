import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { RetryPolicy } from '../domain/retry-policy';
import { BackoffStrategy } from '../domain/backoff-strategy';
import { AttemptResult } from '../../notifications/domain/enums';
import { RETRY_QUEUE } from '../../../shared/infrastructure/queue/queue.module';
import { RedisService } from '../../../shared/infrastructure/queue/redis.service';
import { AppLoggerService } from '../../../shared/infrastructure/logger/logger.service';

@Injectable()
export class RetryHandler {
  private readonly logger = new AppLoggerService();
  private readonly retryQueue: Queue;
  private readonly policy: RetryPolicy;
  private readonly backoff: BackoffStrategy;

  constructor(redisService: RedisService) {
    this.retryQueue = new Queue(RETRY_QUEUE, {
      connection: redisService.connection,
    });
    this.policy = new RetryPolicy({ maxAttempts: 3 });
    this.backoff = new BackoffStrategy(1000, 30000);
  }

  async handleRetry(
    deliveryId: string,
    result: AttemptResult,
    currentAttemptCount: number,
  ): Promise<{ willRetry: boolean; delayMs: number }> {
    if (!this.policy.shouldRetry(result, currentAttemptCount)) {
      this.logger.warn('Delivery will NOT be retried', {
        type: 'delivery_retry',
        deliveryId,
        attemptResult: result,
        currentAttemptCount,
        reason: 'retry policy exhausted or result not retryable',
      });
      return { willRetry: false, delayMs: 0 };
    }

    const delay = this.backoff.getDelay(currentAttemptCount + 1);

    this.logger.log('Enqueueing delivery retry', {
      type: 'queue_enqueue',
      queue: RETRY_QUEUE,
      deliveryId,
      attemptNumber: currentAttemptCount + 1,
      delayMs: delay,
    });

    const enqueueStart = Date.now();
    try {
      const job = await this.retryQueue.add(
        'retry-delivery',
        { deliveryId, attemptNumber: currentAttemptCount + 1 },
        { delay },
      );

      this.logger.warn('Delivery retry scheduled', {
        type: 'delivery_retry',
        queue: RETRY_QUEUE,
        deliveryId,
        jobId: job.id,
        attemptNumber: currentAttemptCount + 1,
        delayMs: delay,
        durationMs: Date.now() - enqueueStart,
      });
    } catch (error) {
      this.logger.error(
        'Failed to enqueue delivery retry (Redis down?)',
        error instanceof Error ? error.stack : String(error),
        {
          type: 'queue_enqueue',
          queue: RETRY_QUEUE,
          deliveryId,
          attemptNumber: currentAttemptCount + 1,
          delayMs: delay,
          durationMs: Date.now() - enqueueStart,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      );
      throw error;
    }

    return { willRetry: true, delayMs: delay };
  }

  isExhausted(attemptCount: number): boolean {
    return this.policy.isExhausted(attemptCount);
  }
}
