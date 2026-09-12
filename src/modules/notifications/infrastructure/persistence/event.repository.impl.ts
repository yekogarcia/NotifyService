import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationEventEntity } from '../../domain/entities/notification-event.entity';

export interface NotificationEventInput {
  tenantId: string;
  notificationId?: string;
  deliveryId?: string;
  eventType: string;
  correlationId: string;
  sourceSystem?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class EventRepositoryImpl {
  constructor(
    @InjectRepository(NotificationEventEntity)
    private readonly repo: Repository<NotificationEventEntity>,
  ) {}

  async record(event: NotificationEventInput): Promise<void> {
    const entity = this.repo.create({
      tenantId: event.tenantId,
      notificationId: event.notificationId ?? null,
      deliveryId: event.deliveryId ?? null,
      eventType: event.eventType,
      correlationId: event.correlationId,
      sourceSystem: event.sourceSystem ?? null,
      metadata: event.metadata ?? {},
    });

    await this.repo.save(entity);
  }
}
