import { Injectable, Inject } from '@nestjs/common';
import {
  NotificationChannel,
  SendResult,
} from '../../domain/channel.interface';
import { PushProvider } from '../../../providers/domain/push-provider.interface';

@Injectable()
export class PushChannel implements NotificationChannel {
  constructor(
    @Inject('PushProvider') private readonly provider: PushProvider,
  ) {}

  async send(
    _deliveryId: string,
    to: string,
    subject: string | null,
    body: string,
  ): Promise<SendResult> {
    const result = await this.provider.sendPush(to, subject ?? '', body);
    return {
      success: result.success,
      providerMessageId: result.providerMessageId,
      errorType: result.errorType,
      errorMessage: result.errorMessage,
    };
  }
}
