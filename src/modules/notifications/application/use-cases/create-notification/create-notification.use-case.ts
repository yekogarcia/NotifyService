import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { CreateNotificationDTO } from '../../dto/create-notification.dto';
import { validateRecipients } from './validate-recipients';
import { ValidateTemplateUseCase } from './validate-template';
import { IdempotencyCheckUseCase } from './idempotency-check';
import { NotificationRepository } from '../../../domain/repositories';
import { NotificationEntity } from '../../../domain/entities/notification.entity';
import { NotificationRecipientEntity } from '../../../domain/entities/notification-recipient.entity';
import { NotificationDeliveryEntity } from '../../../domain/entities/notification-delivery.entity';
import {
  NotificationStatus,
  DeliveryStatus,
  ChannelType,
} from '../../../domain/enums';
import { NOTIFICATION_QUEUE } from '../../../../../shared/infrastructure/queue/queue.module';
import { Queue } from 'bullmq';
import { RedisService } from '../../../../../shared/infrastructure/queue/redis.service';

export interface CreateNotificationResult {
  notificationId: string;
  status: string;
  correlationId: string;
  idempotent: boolean;
}

@Injectable()
export class CreateNotificationUseCase {
  private readonly queue: Queue;

  constructor(
    private readonly notificationRepo: NotificationRepository,
    private readonly idempotencyCheck: IdempotencyCheckUseCase,
    private readonly validateTemplate: ValidateTemplateUseCase,
    private readonly dataSource: DataSource,
    redisService: RedisService,
  ) {
    this.queue = new Queue(NOTIFICATION_QUEUE, {
      connection: redisService.connection,
    });
  }

  async execute(
    tenantId: string,
    dto: CreateNotificationDTO,
  ): Promise<CreateNotificationResult> {
    const correlationId = randomUUID();
    const language = dto.language ?? 'es';

    const existing = await this.idempotencyCheck.execute(
      tenantId,
      dto.idempotencyKey,
    );
    if (existing) {
      return {
        notificationId: existing.id,
        status: existing.status,
        correlationId: existing.correlationId,
        idempotent: true,
      };
    }

    const recipients = dto.recipient
      ? [dto.recipient]
      : dto.recipients ?? [];
    validateRecipients(recipients);

    await this.validateTemplate.execute(
      tenantId,
      dto.templateCode,
      dto.channels,
      language,
    );

    const notification = await this.dataSource.transaction(
      async (manager) => {
        const notification = manager.create(NotificationEntity, {
          tenantId,
          sourceSystem: dto.sourceSystem,
          eventType: dto.eventType,
          templateCode: dto.templateCode,
          data: dto.data ?? {},
          idempotencyKey: dto.idempotencyKey,
          status: NotificationStatus.QUEUED,
          correlationId,
          eventId: null,
        });
        const saved = await manager.save(notification);

        const recipientEntities = recipients.map((r) =>
          manager.create(NotificationRecipientEntity, {
            notificationId: saved.id,
            recipientType: r.recipientType,
            userId: r.userId ?? null,
            email: r.email ?? null,
            phone: r.phone ?? null,
          }),
        );
        const savedRecipients = await manager.save(
          NotificationRecipientEntity,
          recipientEntities,
        );

        const deliveries: NotificationDeliveryEntity[] = [];
        for (const recipient of savedRecipients) {
          for (const channel of dto.channels) {
            deliveries.push(
              manager.create(NotificationDeliveryEntity, {
                notificationId: saved.id,
                recipientId: recipient.id,
                channel,
                status: DeliveryStatus.QUEUED,
                attemptCount: 0,
                maxAttempts: 3,
                providerId: null,
                providerMessageId: null,
              }),
            );
          }
        }
        await manager.save(NotificationDeliveryEntity, deliveries);

        return saved;
      },
    );

    await this.queue.add(
      'process-notification',
      { notificationId: notification.id },
      { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
    );

    return {
      notificationId: notification.id,
      status: notification.status,
      correlationId,
      idempotent: false,
    };
  }
}
