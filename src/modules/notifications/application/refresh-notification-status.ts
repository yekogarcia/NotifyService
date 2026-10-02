import { Injectable, Inject } from '@nestjs/common';
import {
  DeliveryRepository,
  NotificationRepository,
} from '../domain/repositories';
import {
  DeliveryStatus,
  NotificationStatus,
} from '../domain/enums';

const PENDING: ReadonlySet<string> = new Set([
  DeliveryStatus.CREATED,
  DeliveryStatus.QUEUED,
  DeliveryStatus.PROCESSING,
  DeliveryStatus.RETRYING,
]);

/**
 * Recalcula `notifications.status` desde sus deliveries. Sin esto la
 * notificación queda en QUEUED para siempre (solo los deliveries cambian).
 * Regla: todo FAILED → FAILED; todo éxito → DELIVERED si todo es DELIVERED,
 * si no SENT; con pendientes y algo terminal → PROCESSING; sin terminal →
 * se conserva el estado actual.
 */
@Injectable()
export class RefreshNotificationStatusUseCase {
  constructor(
    @Inject('DeliveryRepository')
    private readonly deliveryRepo: DeliveryRepository,
    @Inject('NotificationRepository')
    private readonly notificationRepo: NotificationRepository,
  ) {}

  async refresh(notificationId: string): Promise<NotificationStatus | null> {
    const [notification, deliveries] = await Promise.all([
      this.notificationRepo.findById(notificationId),
      this.deliveryRepo.findByNotificationId(notificationId),
    ]);
    if (!notification || deliveries.length === 0) return null;

    const statuses = deliveries.map((d) => d.status);
    const pending = statuses.filter((s) => PENDING.has(s)).length;
    const failed = statuses.filter(
      (s) => s === DeliveryStatus.FAILED,
    ).length;
    const sent = statuses.filter((s) => s === DeliveryStatus.SENT).length;
    const delivered = statuses.filter(
      (s) => s === DeliveryStatus.DELIVERED,
    ).length;
    const total = statuses.length;

    let next: NotificationStatus | null = null;
    if (failed === total) next = NotificationStatus.FAILED;
    else if (sent + delivered === total)
      next = sent === 0 ? NotificationStatus.DELIVERED : NotificationStatus.SENT;
    else if (pending > 0 && failed + sent + delivered > 0)
      next = NotificationStatus.PROCESSING;

    if (
      next &&
      next !== (notification.status as NotificationStatus)
    ) {
      await this.notificationRepo.updateStatus(notificationId, next);
      return next;
    }
    return null;
  }
}
