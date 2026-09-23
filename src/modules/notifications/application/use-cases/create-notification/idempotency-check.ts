import { Injectable, Inject } from '@nestjs/common';
import { NotificationRepository } from '../../../domain/repositories';
import { NotificationEntity } from '../../../domain/entities/notification.entity';

@Injectable()
export class IdempotencyCheckUseCase {
  constructor(
    @Inject('NotificationRepository')
    private readonly notificationRepo: NotificationRepository,
  ) {}

  async execute(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<NotificationEntity | null> {
    return this.notificationRepo.findByIdempotencyKey(tenantId, idempotencyKey);
  }
}
