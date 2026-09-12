import Twilio from 'twilio';
import { ProviderResult } from '../../domain/email-provider.interface';
import { SmsProvider } from '../../domain/sms-provider.interface';

export interface TwilioAdapterConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export class TwilioAdapter implements SmsProvider {
  private readonly client: ReturnType<typeof Twilio>;
  private readonly fromNumber: string;

  constructor(config: TwilioAdapterConfig) {
    this.client = Twilio(config.accountSid, config.authToken);
    this.fromNumber = config.fromNumber;
  }

  async sendSms(to: string, body: string): Promise<ProviderResult> {
    try {
      const result = await this.client.messages.create({
        to,
        body,
        from: this.fromNumber,
      });
      return {
        success: true,
        providerMessageId: result.sid,
      };
    } catch (error) {
      return {
        success: false,
        errorType:
          error instanceof Error ? error.constructor.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
