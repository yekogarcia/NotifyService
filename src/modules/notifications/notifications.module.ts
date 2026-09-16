import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from './interfaces/controllers/notification.controller';
import { NotificationEntity } from './domain/entities/notification.entity';
import { NotificationRecipientEntity } from './domain/entities/notification-recipient.entity';
import { NotificationDeliveryEntity } from './domain/entities/notification-delivery.entity';
import { NotificationAttemptEntity } from './domain/entities/notification-attempt.entity';
import { NotificationTemplateVersionEntity } from '../templates/domain/entities/template-version.entity';
import { NotificationTemplateEntity } from '../templates/domain/entities/template.entity';
import { NotificationRepositoryImpl } from './infrastructure/persistence/notification.repository.impl';
import { DeliveryRepositoryImpl } from './infrastructure/persistence/delivery.repository.impl';
import { AttemptRepositoryImpl } from './infrastructure/persistence/attempt.repository.impl';
import { CreateNotificationUseCase } from './application/use-cases/create-notification/create-notification.use-case';
import { IdempotencyCheckUseCase } from './application/use-cases/create-notification/idempotency-check';
import { ValidateTemplateUseCase } from './application/use-cases/create-notification/validate-template';
import { QueueModule } from '../../shared/infrastructure/queue/queue.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationEntity,
      NotificationRecipientEntity,
      NotificationDeliveryEntity,
      NotificationAttemptEntity,
      NotificationTemplateEntity,
      NotificationTemplateVersionEntity,
    ]),
    QueueModule,
  ],
  controllers: [NotificationController],
  providers: [
    {
      provide: 'NotificationRepository',
      useClass: NotificationRepositoryImpl,
    },
    {
      provide: 'DeliveryRepository',
      useClass: DeliveryRepositoryImpl,
    },
    {
      provide: 'AttemptRepository',
      useClass: AttemptRepositoryImpl,
    },
    IdempotencyCheckUseCase,
    ValidateTemplateUseCase,
    CreateNotificationUseCase,
  ],
  exports: [
    CreateNotificationUseCase,
    'NotificationRepository',
    'DeliveryRepository',
    'AttemptRepository',
  ],
})
export class NotificationsModule {}
