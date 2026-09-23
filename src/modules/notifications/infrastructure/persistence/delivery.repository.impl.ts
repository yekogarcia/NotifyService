import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationDeliveryEntity } from '../../domain/entities/notification-delivery.entity';
import { DeliveryRepository } from '../../domain/repositories';

@Injectable()
export class DeliveryRepositoryImpl implements DeliveryRepository {
  constructor(
    @InjectRepository(NotificationDeliveryEntity)
    private readonly repo: Repository<NotificationDeliveryEntity>,
  ) {}

  async findById(id: string): Promise<NotificationDeliveryEntity | null> {
    return this.repo.findOne({ where: { id }, relations: ['notification'] });
  }

  async findByNotificationId(
    notificationId: string,
  ): Promise<NotificationDeliveryEntity[]> {
    return this.repo.find({ where: { notificationId } });
  }

  async save(
    delivery: NotificationDeliveryEntity,
  ): Promise<NotificationDeliveryEntity> {
    return this.repo.save(delivery);
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.repo.update(id, {
      status: status as NotificationDeliveryEntity['status'],
    });
  }

  async incrementAttemptCount(id: string): Promise<void> {
    await this.repo.increment({ id }, 'attemptCount', 1);
  }

  async updateProviderId(id: string, providerId: string | null): Promise<void> {
    await this.repo.update(id, { providerId });
  }
}
