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
    this.worker.on('ready', () => this.logger.log('Delivery worker online'));
    this.worker.on('error', (err) =>
      this.logger.error('Delivery worker error', err.stack),
    );
    this.worker.on('failed', (job, err) =>
      this.logger.error('Queue job definitively failed', err.stack, {
        jobId: job?.id,
        notificationId: job?.data?.notificationId,
        deliveryId: job?.data?.deliveryId,
        attemptsMade: job?.attemptsMade,
      }),
    );
    this.worker.on('stalled', (jobId) =>
      this.logger.warn('Queue job stalled', { jobId }),
    );
  }

  private async processJob(job: Job<QueueJobData>): Promise<void> {
    const start = Date.now();
    this.logger.log('Queue job received', {
      jobId: job.id,
      notificationId: job.data.notificationId,
      deliveryId: job.data.deliveryId,
    });

    try {
      const { deliveryId, renderedContent, notificationId } = job.data;

      if (deliveryId && renderedContent) {
        await this.dispatcher.dispatch(deliveryId, renderedContent);
      } else if (notificationId) {
        await this.processNotification(notificationId);
      } else {
        this.logger.error('Job has no recognizable data', undefined, {
          jobId: job.id,
          data: sanitizeForLog(job.data),
        });
      }

      this.logger.log('Queue job completed', {
        jobId: job.id,
        durationMs: Date.now() - start,
      });
    } catch (error) {
      this.logger.error(
        'Queue job processing error (will retry if attempts remain)',
        error instanceof Error ? error.stack : String(error),
        {
          jobId: job.id,
          notificationId: job.data.notificationId,
          deliveryId: job.data.deliveryId,
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
      notificationId,
      deliveriesCount: notification.deliveries.length,
    });

    for (const delivery of notification.deliveries) {
      const recipient = notification.recipients.find(
        (r: NotificationRecipientEntity) => r.id === delivery.recipientId,
      );
      if (!recipient) {
        this.logger.error(
          'Recipient not found for delivery, skipped',
          undefined,
          {
            notificationId,
            deliveryId: delivery.id,
            recipientId: delivery.recipientId,
          },
        );
        continue;
      }

      const to = this.resolveRecipientAddress(delivery.channel, recipient);
      if (!to) {
        this.logger.error(
          'No address for delivery channel, skipped',
          undefined,
          {
            notificationId,
            deliveryId: delivery.id,
            channel: delivery.channel,
          },
        );
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
        this.logger.error(
          'No active template version, delivery skipped',
          undefined,
          {
            notificationId,
            deliveryId: delivery.id,
            templateCode: notification.templateCode,
            channel: delivery.channel,
            language,
          },
        );
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
