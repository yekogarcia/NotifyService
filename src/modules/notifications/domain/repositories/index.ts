import { NotificationEntity } from '../entities/notification.entity';
import { NotificationDeliveryEntity } from '../entities/notification-delivery.entity';
import { NotificationAttemptEntity } from '../entities/notification-attempt.entity';

export interface NotificationRepository {
  findById(id: string): Promise<NotificationEntity | null>;
  findByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<NotificationEntity | null>;
  save(notification: NotificationEntity): Promise<NotificationEntity>;
  updateStatus(id: string, status: string): Promise<void>;
  findWithDeliveriesAndAttempts(id: string): Promise<NotificationEntity | null>;
}

export interface DeliveryRepository {
  findById(id: string): Promise<NotificationDeliveryEntity | null>;
  findByNotificationId(
    notificationId: string,
  ): Promise<NotificationDeliveryEntity[]>;
  save(
    delivery: NotificationDeliveryEntity,
  ): Promise<NotificationDeliveryEntity>;
  updateStatus(id: string, status: string): Promise<void>;
  incrementAttemptCount(id: string): Promise<void>;
  updateProviderId(id: string, providerId: string | null): Promise<void>;
}

export interface AttemptRepository {
  save(attempt: NotificationAttemptEntity): Promise<NotificationAttemptEntity>;
  findByDeliveryId(deliveryId: string): Promise<NotificationAttemptEntity[]>;
}
