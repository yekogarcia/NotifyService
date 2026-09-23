import { Injectable, Inject, Logger } from '@nestjs/common';
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

export interface RenderedContent {
  to: string;
  subject: string | null;
  body: string;
}

@Injectable()
export class DeliveryDispatcher {
  private readonly logger = new Logger(DeliveryDispatcher.name);

  constructor(
    private readonly channelRegistry: ChannelRegistry,
    @Inject('DeliveryRepository')
    private readonly deliveryRepo: DeliveryRepository,
    @Inject('AttemptRepository')
    private readonly attemptRepo: AttemptRepository,
  ) {}

  async dispatch(
    deliveryId: string,
    renderedContent: RenderedContent,
  ): Promise<void> {
    const delivery = await this.deliveryRepo.findById(deliveryId);
    if (!delivery) {
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

    let result;
    try {
      result = await channel.send({
        deliveryId,
        tenantId,
        to: renderedContent.to,
        subject: renderedContent.subject,
        body: renderedContent.body,
      });
    } catch (error) {
      result = {
        success: false,
        errorType:
          error instanceof Error ? error.constructor.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    if (result.providerId) {
      await this.deliveryRepo.updateProviderId(deliveryId, result.providerId);
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
      this.logger.log(
        `Delivery ${deliveryId} sent successfully (attempt ${attemptNumber})`,
      );
    } else {
      attempt.result = AttemptResult.TRANSIENT_ERROR;
      await this.attemptRepo.save(attempt);
      await this.deliveryRepo.incrementAttemptCount(deliveryId);
      await this.deliveryRepo.updateStatus(deliveryId, DeliveryStatus.FAILED);
      this.logger.warn(
        `Delivery ${deliveryId} failed: ${result.errorType ?? 'unknown'} - ${result.errorMessage ?? 'no message'}`,
      );
    }
  }
}
