import { Injectable, OnModuleDestroy, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Worker, Job } from 'bullmq';
import { RedisService } from '../../../../shared/infrastructure/queue/redis.service';
import { NOTIFICATION_QUEUE } from '../../../../shared/infrastructure/queue/queue.module';
import { NotificationRepository } from '../../../notifications/domain/repositories';
import { NotificationTemplateVersionEntity } from '../../../templates/domain/entities/template-version.entity';
import { NotificationRecipientEntity } from '../../../notifications/domain/entities/notification-recipient.entity';
import { ChannelType } from '../../../notifications/domain/enums';
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
  private readonly logger = new Logger(DeliveryWorker.name);
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
  ) {
    this.worker = new Worker(
      NOTIFICATION_QUEUE,
      async (job: Job<QueueJobData>) => {
        await this.processJob(job);
      },
      { connection: redisService.connection },
    );
  }

  private async processJob(job: Job<QueueJobData>): Promise<void> {
    const { deliveryId, renderedContent, notificationId } = job.data;

    if (deliveryId && renderedContent) {
      await this.dispatcher.dispatch(deliveryId, renderedContent);
      return;
    }

    if (notificationId) {
      await this.processNotification(notificationId);
      return;
    }

    this.logger.warn(`Job ${job.id} has no recognizable data`);
  }

  private async processNotification(notificationId: string): Promise<void> {
    const notification =
      await this.notificationRepo.findWithDeliveriesAndAttempts(notificationId);
    if (!notification) {
      throw new Error(`Notification not found: ${notificationId}`);
    }

    const data = notification.data ?? {};
    const language = notification.language ?? 'es';

    for (const delivery of notification.deliveries) {
      const recipient = notification.recipients.find(
        (r: NotificationRecipientEntity) => r.id === delivery.recipientId,
      );
      if (!recipient) {
        this.logger.warn(
          `Recipient ${delivery.recipientId} not found for delivery ${delivery.id}`,
        );
        continue;
      }

      const to = this.resolveRecipientAddress(delivery.channel, recipient);
      if (!to) {
        this.logger.warn(
          `No address found for delivery ${delivery.id} on channel ${delivery.channel}`,
        );
        continue;
      }

      const templateVersion = await this.templateVersionRepo.findOne({
        where: {
          template: {
            tenantId: notification.tenantId,
            code: notification.templateCode,
          },
          channel: delivery.channel,
          language,
          isActive: true,
        },
        relations: ['template'],
      });

      if (!templateVersion) {
        this.logger.warn(
          `No active template version for code ${notification.templateCode}, channel ${delivery.channel}, language ${language}`,
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
