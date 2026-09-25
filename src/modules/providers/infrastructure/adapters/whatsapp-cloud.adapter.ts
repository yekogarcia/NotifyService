import { ProviderResult } from '../../domain/email-provider.interface';
import { WhatsAppProvider } from '../../domain/whatsapp-provider.interface';

export interface WhatsAppCloudAdapterConfig {
  phoneNumberId: string;
  accessToken: string;
  apiVersion?: string;
}

interface MetaErrorResponse {
  error?: {
    message?: string;
    type?: string;
    code?: number | string;
    error_data?: { details?: string };
  };
}

interface MetaSuccessResponse {
  messages?: { id?: string }[];
}

export class WhatsAppCloudAdapter implements WhatsAppProvider {
  private readonly phoneNumberId: string;
  private readonly accessToken: string;
  private readonly apiVersion: string;

  constructor(config: WhatsAppCloudAdapterConfig) {
    this.phoneNumberId = config.phoneNumberId;
    this.accessToken = config.accessToken;
    this.apiVersion = config.apiVersion ?? 'v21.0';
  }

  async sendText(to: string, body: string): Promise<ProviderResult> {
    return this.postMessage({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    });
  }

  async sendTemplate(
    to: string,
    templateName: string,
    language: string,
    params: string[],
  ): Promise<ProviderResult> {
    const template: Record<string, unknown> = {
      name: templateName,
      language: { code: language },
    };
    if (params.length > 0) {
      template.components = [
        {
          type: 'body',
          parameters: params.map((text) => ({ type: 'text', text })),
        },
      ];
    }
    return this.postMessage({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template,
    });
  }

  private async postMessage(
    payload: Record<string, unknown>,
  ): Promise<ProviderResult> {
    try {
      const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as
        MetaSuccessResponse | MetaErrorResponse;

      if (response.ok) {
        const messageId = (data as MetaSuccessResponse).messages?.[0]?.id;
        return {
          success: true,
          providerMessageId: messageId,
        };
      }

      const error = (data as MetaErrorResponse).error;
      return {
        success: false,
        errorType: `HTTP_${response.status}`,
        errorMessage:
          error?.error_data?.details ??
          error?.message ??
          `WhatsApp Cloud API error: ${response.statusText}`,
      };
    } catch (err) {
      return {
        success: false,
        errorType: 'NETWORK_ERROR',
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }
}
