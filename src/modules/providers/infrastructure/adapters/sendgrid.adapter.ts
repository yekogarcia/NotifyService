import { ProviderResult } from '../../domain/email-provider.interface';
import { AppLoggerService } from '../../../../shared/infrastructure/logger/logger.service';

export class SendGridAdapter {
  private readonly apiKey: string;
  private readonly logger: AppLoggerService;

  constructor(
    config: Record<string, unknown>,
    secretRef?: string,
    logger?: AppLoggerService,
  ) {
    this.apiKey =
      (config.apiKey as string | undefined) ??
      (secretRef ? (process.env[secretRef] ?? '') : '');
    this.logger = logger ?? new AppLoggerService();
  }

  async sendEmail(
    to: string,
    subject: string,
    body: string,
  ): Promise<ProviderResult> {
    const start = Date.now();
    this.logger.log('SendGrid sendEmail attempt', {
      type: 'provider_send',
      provider: 'SENDGRID',
      to,
      subject,
    });
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: 'noreply@notitify.service' },
          subject,
          content: [{ type: 'text/plain', value: body }],
        }),
      });

      if (response.ok) {
        this.logger.log('SendGrid sendEmail success', {
          type: 'provider_send',
          provider: 'SENDGRID',
          to,
          providerMessageId: response.headers.get('x-message-id') ?? undefined,
          durationMs: Date.now() - start,
        });
        return {
          success: true,
          providerMessageId: response.headers.get('x-message-id') ?? undefined,
        };
      }

      this.logger.error('SendGrid rejected the email', undefined, {
        type: 'provider_send',
        provider: 'SENDGRID',
        to,
        httpStatus: response.status,
        errorMessage: response.statusText,
        durationMs: Date.now() - start,
      });
      return {
        success: false,
        errorType: `HTTP_${response.status}`,
        errorMessage: `SendGrid error: ${response.statusText}`,
      };
    } catch (err) {
      this.logger.error(
        'SendGrid network error (timeout/unreachable?)',
        err instanceof Error ? err.stack : String(err),
        {
          type: 'provider_send',
          provider: 'SENDGRID',
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
