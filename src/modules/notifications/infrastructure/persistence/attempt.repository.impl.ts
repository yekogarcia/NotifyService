import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationAttemptEntity } from '../../domain/entities/notification-attempt.entity';
import { AttemptRepository } from '../../domain/repositories';

@Injectable()
export class AttemptRepositoryImpl implements AttemptRepository {
  constructor(
    @InjectRepository(NotificationAttemptEntity)
    private readonly repo: Repository<NotificationAttemptEntity>,
  ) {}

  async save(
    attempt: NotificationAttemptEntity,
  ): Promise<NotificationAttemptEntity> {
    return this.repo.save(attempt);
  }

  async findByDeliveryId(
    deliveryId: string,
  ): Promise<NotificationAttemptEntity[]> {
    return this.repo.find({
      where: { deliveryId },
      order: { attemptNumber: 'ASC' },
    });
  }
}
