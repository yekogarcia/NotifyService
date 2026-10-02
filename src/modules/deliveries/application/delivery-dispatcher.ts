import { Injectable, Inject } from '@nestjs/common';
import { ChannelRegistry } from './channel-registry';
import {
  DeliveryRepository,
  AttemptRepository,
} from '../../notifications/domain/repositories';
import {
  DeliveryStatus,
  AttemptResult,
} from '../../notifications/domain/enums';
import { NotificationAttemptEntity } from '../../notifications/domain/entities/notification-attempt.entity';
import { isValidTransition } from '../domain/delivery-status';
import { RefreshNotificationStatusUseCase } from '../../notifications/application/refresh-notification-status';
import { AppLoggerService } from '../../../shared/infrastructure/logger/logger.service';

export interface RenderedContent {
  to: string;
  subject: string | null;
  body: string;
  language?: string;
  templateParams?: string[];
  /** Remitente de la plantilla (solo EMAIL; fallback al del proveedor). */
  from?: string;
}

@Injectable()
export class DeliveryDispatcher {
  constructor(
    private readonly channelRegistry: ChannelRegistry,
    @Inject('DeliveryRepository')
    private readonly deliveryRepo: DeliveryRepository,
    @Inject('AttemptRepository')
    private readonly attemptRepo: AttemptRepository,
    private readonly refreshStatus: RefreshNotificationStatusUseCase,
    private readonly logger: AppLoggerService,
  ) {}

  async dispatch(
    deliveryId: string,
    renderedContent: RenderedContent,
  ): Promise<void> {
    const start = Date.now();
    const delivery = await this.deliveryRepo.findById(deliveryId);
    if (!delivery) {
      this.logger.error('Delivery not found, cannot dispatch', undefined, {
        type: 'delivery_dispatch',
        deliveryId,
      });
      throw new Error(`Delivery not found: ${deliveryId}`);
    }

    if (!isValidTransition(delivery.status, DeliveryStatus.PROCESSING)) {
      throw new Error(
        `Invalid status transition from ${delivery.status} to ${DeliveryStatus.PROCESSING} for delivery ${deliveryId}`,
      );
    }

    await this.deliveryRepo.updateStatus(deliveryId, DeliveryStatus.PROCESSING);

    const tenantId = delivery.notification?.tenantId;
    if (!tenantId) {
      throw new Error(`Notification not found for delivery: ${deliveryId}`);
    }

    const channel = this.channelRegistry.getChannel(delivery.channel);

    this.logger.log('Dispatching delivery to channel', {
      type: 'delivery_dispatch',
      deliveryId,
      notificationId: delivery.notificationId,
      channel: delivery.channel,
      to: renderedContent.to,
      attemptNumber: delivery.attemptCount + 1,
    });

    let result;
    try {
      result = await channel.send({
        deliveryId,
        tenantId,
        to: renderedContent.to,
        subject: renderedContent.subject,
        body: renderedContent.body,
        language: renderedContent.language,
        templateParams: renderedContent.templateParams,
        from: renderedContent.from,
      });
    } catch (error) {
      result = {
        success: false,
        errorType:
          error instanceof Error ? error.constructor.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
      this.logger.error(
        'Channel send threw an exception',
        error instanceof Error ? error.stack : String(error),
        {
          type: 'delivery_dispatch',
          deliveryId,
          notificationId: delivery.notificationId,
          channel: delivery.channel,
          to: renderedContent.to,
          errorMessage: result.errorMessage,
        },
      );
    }

    if (result.providerId) {
      await this.deliveryRepo.updateProviderId(deliveryId, result.providerId);
    }
    if (result.providerMessageId) {
      await this.deliveryRepo.updateProviderMessageId(
        deliveryId,
        result.providerMessageId,
      );
    }

    const attemptNumber = delivery.attemptCount + 1;
    const attempt = new NotificationAttemptEntity();
    attempt.deliveryId = deliveryId;
    attempt.attemptNumber = attemptNumber;
    attempt.providerMessageId = result.providerMessageId ?? null;
    attempt.errorType = result.errorType ?? null;
    attempt.errorMessage = result.errorMessage ?? null;
    attempt.attemptedAt = new Date();

    if (result.success) {
      attempt.result = AttemptResult.SUCCESS;
      await this.attemptRepo.save(attempt);
      await this.deliveryRepo.incrementAttemptCount(deliveryId);
      await this.deliveryRepo.updateStatus(deliveryId, DeliveryStatus.SENT);
      this.logger.log('Delivery sent successfully', {
        type: 'delivery_dispatch',
        deliveryId,
        notificationId: delivery.notificationId,
        channel: delivery.channel,
        to: renderedContent.to,
        attemptNumber,
        providerId: result.providerId,
        providerMessageId: result.providerMessageId,
        newStatus: DeliveryStatus.SENT,
        durationMs: Date.now() - start,
      });
    } else {
      attempt.result = AttemptResult.TRANSIENT_ERROR;
      await this.attemptRepo.save(attempt);
      await this.deliveryRepo.incrementAttemptCount(deliveryId);
      await this.deliveryRepo.updateStatus(deliveryId, DeliveryStatus.FAILED);
      this.logger.warn('Delivery failed', {
        type: 'delivery_dispatch',
        deliveryId,
        notificationId: delivery.notificationId,
        channel: delivery.channel,
        to: renderedContent.to,
        attemptNumber,
        errorType: result.errorType ?? 'unknown',
        errorMessage: result.errorMessage ?? 'no message',
        newStatus: DeliveryStatus.FAILED,
        durationMs: Date.now() - start,
      });
    }
    // La notificación agrega el estado de sus deliveries (si no, queda QUEUED).
    await this.refreshStatus.refresh(delivery.notificationId);
  }
}
