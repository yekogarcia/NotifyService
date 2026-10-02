import { Controller, Post, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Queue } from 'bullmq';
import { NOTIFICATION_QUEUE } from '../../../../shared/infrastructure/queue/queue.module';
import { RedisService } from '../../../../shared/infrastructure/queue/redis.service';
import { AppLoggerService } from '../../../../shared/infrastructure/logger/logger.service';
import { DeliveryStatus } from '../../../notifications/domain/enums';

@ApiTags('deliveries')
@Controller('deliveries')
export class DeliveryController {
  private readonly queue: Queue;

  constructor(
    redisService: RedisService,
    private readonly logger: AppLoggerService,
  ) {
    this.queue = new Queue(NOTIFICATION_QUEUE, {
      connection: redisService.connection,
    });
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually retry a failed delivery' })
  @ApiResponse({ status: 200, description: 'Delivery re-queued' })
  async retry(@Param('id') id: string) {
    this.logger.log('Enqueueing manual delivery retry to Redis queue', {
      type: 'queue_enqueue',
      queue: NOTIFICATION_QUEUE,
      deliveryId: id,
      manual: true,
    });
    const enqueueStart = Date.now();
    try {
      const job = await this.queue.add(
        'retry-delivery',
        { deliveryId: id, manual: true },
        { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
      );
      this.logger.log('Manual delivery retry enqueued', {
        type: 'queue_enqueue',
        queue: NOTIFICATION_QUEUE,
        deliveryId: id,
        jobId: job.id,
        durationMs: Date.now() - enqueueStart,
      });
    } catch (error) {
      this.logger.error(
        'Failed to enqueue manual delivery retry (Redis down?)',
        error instanceof Error ? error.stack : String(error),
        {
          type: 'queue_enqueue',
          queue: NOTIFICATION_QUEUE,
          deliveryId: id,
          durationMs: Date.now() - enqueueStart,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      );
      throw error;
    }

    return {
      deliveryId: id,
      status: DeliveryStatus.QUEUED,
      message: 'Delivery re-queued for processing',
    };
  }
}
