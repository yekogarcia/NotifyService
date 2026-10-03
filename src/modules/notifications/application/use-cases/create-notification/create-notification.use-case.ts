import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { CreateNotificationDTO } from '../../dto/create-notification.dto';
import { validateRecipients } from './validate-recipients';
import { validateWhatsAppRecipients } from './validate-whatsapp-recipients';
import { ValidateTemplateUseCase } from './validate-template';
import { IdempotencyCheckUseCase } from './idempotency-check';
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
import { AppLoggerService } from '../../../../../shared/infrastructure/logger/logger.service';

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
    private readonly idempotencyCheck: IdempotencyCheckUseCase,
    private readonly validateTemplate: ValidateTemplateUseCase,
    private readonly dataSource: DataSource,
    redisService: RedisService,
    private readonly logger: AppLoggerService,
  ) {
    this.queue = new Queue(NOTIFICATION_QUEUE, {
      connection: redisService.connection,
    });
  }

  async execute(
    tenantId: string,
    applicationId: string,
    dto: CreateNotificationDTO,
  ): Promise<CreateNotificationResult> {
    if (!applicationId) {
      throw new BadRequestException(
        'applicationId is required (use a client_credentials token)',
      );
    }
    const correlationId = randomUUID();
    const language = dto.language ?? 'es';
    // Sin clave del cliente no hay deduplicación posible: se genera UUID.
    const idempotencyKey = dto.idempotencyKey?.trim() || randomUUID();

    this.logger.log('Notification creation started', {
      correlationId,
      tenantId,
      templateCode: dto.templateCode,
      channels: dto.channels,
      recipientsCount: dto.recipient ? 1 : (dto.recipients?.length ?? 0),
    });

    const existing = await this.idempotencyCheck.execute(
      tenantId,
      idempotencyKey,
    );
    if (existing) {
      this.logger.log('Notification already exists (idempotent hit)', {
        notificationId: existing.id,
        correlationId: existing.correlationId,
      });
      return {
        notificationId: existing.id,
        status: existing.status,
        correlationId: existing.correlationId,
        idempotent: true,
      };
    }

    const recipients = dto.recipient ? [dto.recipient] : (dto.recipients ?? []);
    validateRecipients(recipients);
    if (dto.channels.includes(ChannelType.WHATSAPP)) {
      validateWhatsAppRecipients(recipients);
    }

    await this.validateTemplate.execute(
      tenantId,
      dto.templateCode,
      dto.channels,
      language,
    );

    const notification = await this.dataSource.transaction(async (manager) => {
      const notification = manager.create(NotificationEntity, {
        tenantId,
        applicationId,
        sourceSystem: dto.sourceSystem,
        eventType: dto.eventType,
        templateCode: dto.templateCode,
        language,
        data: dto.data ?? {},
        idempotencyKey,
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

      this.logger.log('Notification persisted with deliveries', {
        correlationId,
        notificationId: saved.id,
        deliveriesCount: deliveries.length,
      });

      return saved;
    });

    // Si Redis está caído este queue.add se BLOQUEA indefinidamente
    // (maxRetriesPerRequest=null) y el request termina en 504 en el proxy.
    // El log "enqueue attempt" sin su par "enqueue success/failed" lo delata.
    this.logger.log('Enqueueing notification job to Redis queue', {
      notificationId: notification.id,
    });
    try {
      const job = await this.queue.add(
        'process-notification',
        { notificationId: notification.id },
        { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
      );
      this.logger.log('Notification job enqueued', {
        notificationId: notification.id,
        jobId: job.id,
      });
    } catch (error) {
      this.logger.error(
        'Failed to enqueue notification job (Redis down?)',
        error instanceof Error ? error.stack : String(error),
        { notificationId: notification.id },
      );
      throw error;
    }

    return {
      notificationId: notification.id,
      status: notification.status,
      correlationId,
      idempotent: false,
    };
  }
}
