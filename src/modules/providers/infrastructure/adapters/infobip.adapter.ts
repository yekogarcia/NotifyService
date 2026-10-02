import { ProviderResult } from '../../domain/email-provider.interface';
import { AppLoggerService } from '../../../../shared/infrastructure/logger/logger.service';

export class InfobipAdapter {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly from: string;
  private readonly logger: AppLoggerService;

  constructor(
    config: Record<string, unknown>,
    secretRef?: string,
    logger?: AppLoggerService,
  ) {
    this.baseUrl = (config.baseUrl as string) ?? 'https://api.infobip.com';
    this.apiKey =
      (config.apiKey as string | undefined) ??
      (secretRef ? (process.env[secretRef] ?? '') : '');
    this.from = (config.from as string) ?? 'Notitify';
    this.logger = logger ?? new AppLoggerService();
  }

  async sendSms(to: string, body: string): Promise<ProviderResult> {
    const start = Date.now();
    this.logger.log('Infobip sendSms attempt', {
      type: 'provider_send',
      provider: 'INFOBIP',
      to,
      from: this.from,
    });
    try {
      const response = await fetch(`${this.baseUrl}/sms/2/messages`, {
        method: 'POST',
        headers: {
          Authorization: `IB ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ from: this.from, to, text: body }],
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          messages: { messageId: string }[];
        };
        this.logger.log('Infobip sendSms success', {
          type: 'provider_send',
          provider: 'INFOBIP',
          to,
          providerMessageId: data.messages[0]?.messageId,
          durationMs: Date.now() - start,
        });
        return {
          success: true,
          providerMessageId: data.messages[0]?.messageId,
        };
      }

      this.logger.error('Infobip rejected the SMS', undefined, {
        type: 'provider_send',
        provider: 'INFOBIP',
        to,
        httpStatus: response.status,
        errorMessage: response.statusText,
        durationMs: Date.now() - start,
      });
      return {
        success: false,
        errorType: `HTTP_${response.status}`,
        errorMessage: `Infobip error: ${response.statusText}`,
      };
    } catch (err) {
      this.logger.error(
        'Infobip network error (timeout/unreachable?)',
        err instanceof Error ? err.stack : String(err),
        {
          type: 'provider_send',
          provider: 'INFOBIP',
          to,
          durationMs: Date.now() - start,
          errorMessage: err instanceof Error ? err.message : 'Unknown error',
        },
      );
      return {
        success: false,
        errorType: 'TIMEOUT',
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }
}
