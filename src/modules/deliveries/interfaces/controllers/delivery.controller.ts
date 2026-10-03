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
    try {
      const job = await this.queue.add(
        'retry-delivery',
        { deliveryId: id, manual: true },
        { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
      );
      this.logger.log('Manual delivery retry enqueued', {
        deliveryId: id,
        jobId: job.id,
      });
    } catch (error) {
      this.logger.error(
        'Failed to enqueue manual delivery retry (Redis down?)',
        error instanceof Error ? error.stack : String(error),
        { deliveryId: id },
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
