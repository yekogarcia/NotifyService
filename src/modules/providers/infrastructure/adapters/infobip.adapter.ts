import { ProviderResult } from '../domain/email-provider.interface';

export class InfobipAdapter {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly from: string;

  constructor(
    config: Record<string, unknown>,
    secretRef: string,
  ) {
    this.baseUrl = (config.baseUrl as string) ?? 'https://api.infobip.com';
    this.apiKey = process.env[secretRef] ?? '';
    this.from = (config.from as string) ?? 'Notitify';
  }

  async sendSms(to: string, body: string): Promise<ProviderResult> {
    try {
      const response = await fetch(
        `${this.baseUrl}/sms/2/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `IB ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [{ from: this.from, to, text: body }],
          }),
        },
      );

      if (response.ok) {
        const data = await response.json() as { messages: { messageId: string }[] };
        return {
          success: true,
          providerMessageId: data.messages[0]?.messageId,
        };
      }

      return {
        success: false,
        errorType: `HTTP_${response.status}`,
        errorMessage: `Infobip error: ${response.statusText}`,
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
