import { Injectable, Inject } from '@nestjs/common';
import {
  NotificationChannel,
  SendResult,
} from '../../domain/channel.interface';
import { SmsProvider } from '../../../providers/domain/sms-provider.interface';

@Injectable()
export class SmsChannel implements NotificationChannel {
  constructor(@Inject('SmsProvider') private readonly provider: SmsProvider) {}

  async send(
    _deliveryId: string,
    to: string,
    _subject: string | null,
    body: string,
  ): Promise<SendResult> {
    const result = await this.provider.sendSms(to, body);
    return {
      success: result.success,
      providerMessageId: result.providerMessageId,
      errorType: result.errorType,
      errorMessage: result.errorMessage,
    };
  }
}
