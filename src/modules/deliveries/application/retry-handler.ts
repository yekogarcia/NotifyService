import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { RetryPolicy } from '../domain/retry-policy';
import { BackoffStrategy } from '../domain/backoff-strategy';
import { AttemptResult } from '../../notifications/domain/enums';
import { RETRY_QUEUE } from '../../../shared/infrastructure/queue/queue.module';
import { RedisService } from '../../../shared/infrastructure/queue/redis.service';

@Injectable()
export class RetryHandler {
  private readonly logger = new Logger(RetryHandler.name);
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
      return { willRetry: false, delayMs: 0 };
    }

    const delay = this.backoff.getDelay(currentAttemptCount + 1);

    await this.retryQueue.add(
      'retry-delivery',
      { deliveryId, attemptNumber: currentAttemptCount + 1 },
      { delay },
    );

    this.logger.warn(`Scheduling retry for delivery ${deliveryId}`, {
      attemptNumber: currentAttemptCount + 1,
      delayMs: delay,
    });

    return { willRetry: true, delayMs: delay };
  }

  isExhausted(attemptCount: number): boolean {
    return this.policy.isExhausted(attemptCount);
  }
}
