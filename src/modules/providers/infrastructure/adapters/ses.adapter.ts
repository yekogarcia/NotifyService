import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import {
  EmailProvider,
  ProviderResult,
} from '../../domain/email-provider.interface';

export interface SesAdapterConfig {
  region: string;
  fromAddress: string;
  secretRef: string;
}

export class SesAdapter implements EmailProvider {
  private readonly client: SESClient;
  private readonly fromAddress: string;

  constructor(config: SesAdapterConfig) {
    this.client = new SESClient({ region: config.region });
    this.fromAddress = config.fromAddress;
  }

  async sendEmail(
    to: string,
    subject: string,
    body: string,
  ): Promise<ProviderResult> {
    try {
      const command = new SendEmailCommand({
        Source: this.fromAddress,
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: subject },
          Body: { Html: { Data: body } },
        },
      });
      const result = await this.client.send(command);
      return {
        success: true,
        providerMessageId: result.MessageId,
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
