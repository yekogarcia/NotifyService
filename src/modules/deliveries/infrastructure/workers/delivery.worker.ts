import { Injectable, OnModuleDestroy, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Worker, Job } from 'bullmq';
import { RedisService } from '../../../../shared/infrastructure/queue/redis.service';
import { NOTIFICATION_QUEUE } from '../../../../shared/infrastructure/queue/queue.module';
import { AppLoggerService } from '../../../../shared/infrastructure/logger/logger.service';
import { sanitizeForLog } from '../../../../shared/infrastructure/logging/log-sanitizer';
import { NotificationRepository } from '../../../notifications/domain/repositories';
import { NotificationTemplateVersionEntity } from '../../../templates/domain/entities/template-version.entity';
import { NotificationRecipientEntity } from '../../../notifications/domain/entities/notification-recipient.entity';
import {
  ChannelType,
  TemplateStatus,
} from '../../../notifications/domain/enums';
import { TemplateRenderer } from '../../../templates/application/template-renderer';
import {
  DeliveryDispatcher,
  RenderedContent,
} from '../../application/delivery-dispatcher';

interface QueueJobData {
  notificationId?: string;
  deliveryId?: string;
  renderedContent?: RenderedContent;
}

@Injectable()
export class DeliveryWorker implements OnModuleDestroy {
  private readonly worker: Worker;

  constructor(
    private readonly dispatcher: DeliveryDispatcher,
    @Inject('NotificationRepository')
    private readonly notificationRepo: NotificationRepository,
    @InjectRepository(NotificationTemplateVersionEntity)
    private readonly templateVersionRepo: Repository<NotificationTemplateVersionEntity>,
    @Inject('TemplateRenderer')
    private readonly renderer: TemplateRenderer,
    redisService: RedisService,
    private readonly logger: AppLoggerService,
  ) {
    this.worker = new Worker(
      NOTIFICATION_QUEUE,
      async (job: Job<QueueJobData>) => {
        await this.processJob(job);
      },
      { connection: redisService.connection },
    );

    // Eventos de ciclo de vida del worker: si Redis falla o un job agota sus
    // reintentos, antes de esto NO quedaba ningún rastro en logs.
    this.worker.on('ready', () =>
      this.logger.log('Delivery worker online', {
        type: 'queue_worker',
        queue: NOTIFICATION_QUEUE,
      }),
    );
    this.worker.on('error', (err) =>
      this.logger.error(
        'Delivery worker error (Redis connection?)',
        err.stack,
        {
          type: 'queue_worker',
          queue: NOTIFICATION_QUEUE,
          errorMessage: err.message,
        },
      ),
    );
    this.worker.on('failed', (job, err) =>
      this.logger.error(
        'Queue job definitively failed (attempts exhausted)',
        err.stack,
        {
          type: 'queue_worker',
          queue: NOTIFICATION_QUEUE,
          jobId: job?.id,
          jobName: job?.name,
          attemptsMade: job?.attemptsMade,
          data: sanitizeForLog(job?.data),
          errorMessage: err.message,
        },
      ),
    );
    this.worker.on('stalled', (jobId) =>
      this.logger.warn('Queue job stalled (worker died mid-process?)', {
        type: 'queue_worker',
        queue: NOTIFICATION_QUEUE,
        jobId,
      }),
    );
  }

  private async processJob(job: Job<QueueJobData>): Promise<void> {
    const start = Date.now();
    this.logger.log('Queue job received', {
      type: 'queue_job',
      queue: NOTIFICATION_QUEUE,
      jobId: job.id,
      jobName: job.name,
      attemptsMade: job.attemptsMade,
      data: sanitizeForLog(job.data),
    });

    try {
      const { deliveryId, renderedContent, notificationId } = job.data;

      if (deliveryId && renderedContent) {
        await this.dispatcher.dispatch(deliveryId, renderedContent);
      } else if (notificationId) {
        await this.processNotification(notificationId);
      } else {
        this.logger.warn('Job has no recognizable data', {
          type: 'queue_job',
          queue: NOTIFICATION_QUEUE,
          jobId: job.id,
          data: sanitizeForLog(job.data),
        });
      }

      this.logger.log('Queue job completed', {
        type: 'queue_job',
        queue: NOTIFICATION_QUEUE,
        jobId: job.id,
        jobName: job.name,
        durationMs: Date.now() - start,
      });
    } catch (error) {
      this.logger.error(
        'Queue job processing error (will retry if attempts remain)',
        error instanceof Error ? error.stack : String(error),
        {
          type: 'queue_job',
          queue: NOTIFICATION_QUEUE,
          jobId: job.id,
          jobName: job.name,
          attemptsMade: job.attemptsMade,
          durationMs: Date.now() - start,
          data: sanitizeForLog(job.data),
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      );
      throw error;
    }
  }

  private async processNotification(notificationId: string): Promise<void> {
    const notification =
      await this.notificationRepo.findWithDeliveriesAndAttempts(notificationId);
    if (!notification) {
      throw new Error(`Notification not found: ${notificationId}`);
    }

    const data = notification.data ?? {};
    const language = notification.language ?? 'es';

    this.logger.log('Processing notification deliveries', {
      type: 'queue_job',
      notificationId,
      deliveriesCount: notification.deliveries.length,
      templateCode: notification.templateCode,
      language,
    });

    for (const delivery of notification.deliveries) {
      const recipient = notification.recipients.find(
        (r: NotificationRecipientEntity) => r.id === delivery.recipientId,
      );
      if (!recipient) {
        this.logger.warn('Recipient not found for delivery, skipped', {
          type: 'queue_job',
          notificationId,
          deliveryId: delivery.id,
          recipientId: delivery.recipientId,
        });
        continue;
      }

      const to = this.resolveRecipientAddress(delivery.channel, recipient);
      if (!to) {
        this.logger.warn('No address for delivery channel, skipped', {
          type: 'queue_job',
          notificationId,
          deliveryId: delivery.id,
          channel: delivery.channel,
        });
        continue;
      }

      const templateVersion = await this.templateVersionRepo.findOne({
        where: {
          template: {
            tenantId: notification.tenantId,
            code: notification.templateCode,
            status: TemplateStatus.ACTIVE,
          },
          channel: delivery.channel,
          language,
          isActive: true,
        },
        relations: ['template'],
      });

      if (!templateVersion) {
        this.logger.warn('No active template version, delivery skipped', {
          type: 'queue_job',
          notificationId,
          deliveryId: delivery.id,
          templateCode: notification.templateCode,
          channel: delivery.channel,
          language,
        });
        continue;
      }

      const body = this.renderer.render(templateVersion.body, data);
      const templateParams = templateVersion.body
        ? this.renderer
            .extractVariables(templateVersion.body)
            .map((name) => this.renderer.render(`{{${name}}}`, data))
        : [];

      const content: RenderedContent = {
        to,
        subject: templateVersion.subject,
        body,
        language: templateVersion.language,
        templateParams,
        from: templateVersion.template.fromEmail ?? undefined,
      };

      await this.dispatcher.dispatch(delivery.id, content);
    }
  }

  private resolveRecipientAddress(
    channel: ChannelType,
    recipient: NotificationRecipientEntity,
  ): string | null {
    switch (channel) {
      case ChannelType.EMAIL:
        return recipient.email;
      case ChannelType.SMS:
        return recipient.phone;
      case ChannelType.WHATSAPP:
        return recipient.phone;
      case ChannelType.PUSH:
        return recipient.userId;
      default:
        return null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
  }
}
