import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import {
  EmailProvider,
  ProviderResult,
} from '../../domain/email-provider.interface';
import { AppLoggerService } from '../../../../shared/infrastructure/logger/logger.service';

export interface SesAdapterConfig {
  region: string;
  fromAddress: string;
  secretRef: string;
}

export class SesAdapter implements EmailProvider {
  private readonly client: SESClient;
  private readonly fromAddress: string;
  private readonly logger: AppLoggerService;

  constructor(config: SesAdapterConfig, logger?: AppLoggerService) {
    this.client = new SESClient({ region: config.region });
    this.fromAddress = config.fromAddress;
    this.logger = logger ?? new AppLoggerService();
  }

  async sendEmail(
    to: string,
    subject: string,
    body: string,
    from?: string,
  ): Promise<ProviderResult> {
    const start = Date.now();
    const source = from?.trim() || this.fromAddress;
    this.logger.log('SES sendEmail attempt', {
      type: 'provider_send',
      provider: 'SES',
      to,
      from: source,
      subject,
    });
    try {
      const command = new SendEmailCommand({
        Source: source,
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: subject },
          Body: { Html: { Data: body } },
        },
      });
      const result = await this.client.send(command);
      this.logger.log('SES sendEmail success', {
        type: 'provider_send',
        provider: 'SES',
        to,
        providerMessageId: result.MessageId,
        durationMs: Date.now() - start,
      });
      return {
        success: true,
        providerMessageId: result.MessageId,
      };
    } catch (error) {
      this.logger.error(
        'SES sendEmail failed',
        error instanceof Error ? error.stack : String(error),
        {
          type: 'provider_send',
          provider: 'SES',
          to,
          from: source,
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
