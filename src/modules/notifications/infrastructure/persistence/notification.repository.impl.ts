import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationEntity } from '../../domain/entities/notification.entity';
import { NotificationRepository } from '../../domain/repositories';

@Injectable()
export class NotificationRepositoryImpl implements NotificationRepository {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly repo: Repository<NotificationEntity>,
  ) {}

  async findById(id: string): Promise<NotificationEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<NotificationEntity | null> {
    return this.repo.findOne({ where: { tenantId, idempotencyKey } });
  }

  async save(
    notification: NotificationEntity,
  ): Promise<NotificationEntity> {
    return this.repo.save(notification);
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.repo.update(id, { status: status as NotificationEntity['status'] });
  }

  async findWithDeliveriesAndAttempts(
    id: string,
  ): Promise<NotificationEntity | null> {
    return this.repo.findOne({
      where: { id },
      relations: ['recipients', 'deliveries', 'deliveries.attempts'],
    });
  }
}
