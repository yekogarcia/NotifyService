import { ProviderResult } from '../domain/email-provider.interface';

export class SendGridAdapter {
  private readonly apiKey: string;

  constructor(
    config: Record<string, unknown>,
    secretRef: string,
  ) {
    this.apiKey = process.env[secretRef] ?? '';
  }

  async sendEmail(
    to: string,
    subject: string,
    body: string,
  ): Promise<ProviderResult> {
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
        return {
          success: true,
          providerMessageId: response.headers.get('x-message-id') ?? undefined,
        };
      }

      return {
        success: false,
        errorType: `HTTP_${response.status}`,
        errorMessage: `SendGrid error: ${response.statusText}`,
      };
    } catch (err) {
      return {
        success: false,
        errorType: 'TIMEOUT',
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }
}
