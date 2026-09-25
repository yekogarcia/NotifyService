import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { DeliveryRepository } from '../../notifications/domain/repositories';
import { DeliveryStatus } from '../../notifications/domain/enums';
import { isValidTransition } from '../domain/delivery-status';

export interface WhatsappStatusUpdate {
  wamid: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  errorCode?: string;
  errorMessage?: string;
}

export interface WhatsappWebhookPayload {
  entry?: {
    changes?: {
      value?: {
        statuses?: {
          id?: string;
          status?: string;
          errors?: {
            code?: number | string;
            title?: string;
            message?: string;
          }[];
        }[];
      };
    }[];
  }[];
}

@Injectable()
export class HandleWhatsappStatusUseCase {
  private readonly logger = new Logger(HandleWhatsappStatusUseCase.name);

  constructor(
    @Inject('DeliveryRepository')
    private readonly deliveryRepo: DeliveryRepository,
  ) {}

  parseStatuses(payload: WhatsappWebhookPayload): WhatsappStatusUpdate[] {
    const updates: WhatsappStatusUpdate[] = [];
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const status of change.value?.statuses ?? []) {
          if (!status.id || !status.status) continue;
          const error = status.errors?.[0];
          updates.push({
            wamid: status.id,
            status: status.status as WhatsappStatusUpdate['status'],
            errorCode:
              error?.code !== undefined ? String(error.code) : undefined,
            errorMessage: error?.message ?? error?.title,
          });
        }
      }
    }
    return updates;
  }

  async handle(payload: WhatsappWebhookPayload): Promise<number> {
    const updates = this.parseStatuses(payload);
    let applied = 0;

    for (const update of updates) {
      try {
        const handled = await this.apply(update);
        if (handled) applied += 1;
      } catch (err) {
        this.logger.warn(
          `Failed to apply status ${update.status} for ${update.wamid}: ${
            err instanceof Error ? err.message : 'unknown error'
          }`,
        );
      }
    }

    return applied;
  }

  private async apply(update: WhatsappStatusUpdate): Promise<boolean> {
    const delivery = await this.deliveryRepo.findByProviderMessageId(
      update.wamid,
    );
    if (!delivery) {
      this.logger.warn(`No delivery found for wamid ${update.wamid}`);
      return false;
    }

    const target = this.mapStatus(update.status);
    if (!target) {
      this.logger.debug(
        `Ignoring webhook status "${update.status}" for delivery ${delivery.id}`,
      );
      return false;
    }

    if (delivery.status === target) {
      return false;
    }

    if (!isValidTransition(delivery.status, target)) {
      this.logger.warn(
        `Invalid transition ${delivery.status} → ${target} for delivery ${delivery.id} (wamid ${update.wamid})`,
      );
      return false;
    }

    await this.deliveryRepo.updateStatus(delivery.id, target);
    this.logger.log(
      `Delivery ${delivery.id} → ${target} via WhatsApp webhook (${update.wamid})`,
    );
    if (update.errorMessage) {
      this.logger.warn(
        `WhatsApp failure detail for ${delivery.id}: ${update.errorCode ?? ''} ${update.errorMessage}`,
      );
    }
    return true;
  }

  private mapStatus(status: string): DeliveryStatus | null {
    switch (status) {
      case 'sent':
        return DeliveryStatus.SENT;
      case 'delivered':
        return DeliveryStatus.DELIVERED;
      case 'failed':
        return DeliveryStatus.FAILED;
      case 'read':
        return null;
      default:
        return null;
    }
  }

  verifyChallenge(
    mode: string | undefined,
    token: string | undefined,
    challenge: string | undefined,
  ): string {
    const expected = process.env.WHATSAPP_VERIFY_TOKEN;
    if (
      mode !== 'subscribe' ||
      !expected ||
      !token ||
      token !== expected ||
      !challenge
    ) {
      throw new BadRequestException('Verification failed');
    }
    return challenge;
  }

  verifySignature(rawBody: string, signature: string | undefined): void {
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (!appSecret) return;
    if (!signature || !signature.startsWith('sha256=')) {
      throw new BadRequestException('Missing webhook signature');
    }
    const expected = createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');
    const received = signature.slice('sha256='.length);
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(received, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new BadRequestException('Invalid webhook signature');
    }
  }
}
