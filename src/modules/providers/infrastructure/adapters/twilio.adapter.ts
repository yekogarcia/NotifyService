import Twilio from 'twilio';
import { ProviderResult } from '../../domain/email-provider.interface';
import { SmsProvider } from '../../domain/sms-provider.interface';
import { AppLoggerService } from '../../../../shared/infrastructure/logger/logger.service';

export interface TwilioAdapterConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export class TwilioAdapter implements SmsProvider {
  private readonly client: ReturnType<typeof Twilio>;
  private readonly fromNumber: string;
  private readonly logger: AppLoggerService;

  constructor(config: TwilioAdapterConfig, logger?: AppLoggerService) {
    this.client = Twilio(config.accountSid, config.authToken);
    this.fromNumber = config.fromNumber;
    this.logger = logger ?? new AppLoggerService();
  }

  async sendSms(to: string, body: string): Promise<ProviderResult> {
    const start = Date.now();
    this.logger.log('Twilio sendSms attempt', {
      type: 'provider_send',
      provider: 'TWILIO',
      to,
      from: this.fromNumber,
    });
    try {
      const result = await this.client.messages.create({
        to,
        body,
        from: this.fromNumber,
      });
      this.logger.log('Twilio sendSms success', {
        type: 'provider_send',
        provider: 'TWILIO',
        to,
        providerMessageId: result.sid,
        messageStatus: result.status,
        durationMs: Date.now() - start,
      });
      return {
        success: true,
        providerMessageId: result.sid,
      };
    } catch (error) {
      this.logger.error(
        'Twilio sendSms failed',
        error instanceof Error ? error.stack : String(error),
        {
          type: 'provider_send',
          provider: 'TWILIO',
          to,
          from: this.fromNumber,
          durationMs: Date.now() - start,
          errorType:
            error instanceof Error ? error.constructor.name : 'UnknownError',
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
        },
      );
      return {
        success: false,
        errorType:
          error instanceof Error ? error.constructor.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
