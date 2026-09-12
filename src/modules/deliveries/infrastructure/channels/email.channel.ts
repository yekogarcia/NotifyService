import { Injectable, Inject } from '@nestjs/common';
import {
  NotificationChannel,
  SendResult,
} from '../../domain/channel.interface';
import { EmailProvider } from '../../../providers/domain/email-provider.interface';

@Injectable()
export class EmailChannel implements NotificationChannel {
  constructor(
    @Inject('EmailProvider') private readonly provider: EmailProvider,
  ) {}

  async send(
    _deliveryId: string,
    to: string,
    subject: string | null,
    body: string,
  ): Promise<SendResult> {
    const result = await this.provider.sendEmail(to, subject ?? '', body);
    return {
      success: result.success,
      providerMessageId: result.providerMessageId,
      errorType: result.errorType,
      errorMessage: result.errorMessage,
    };
  }
}
