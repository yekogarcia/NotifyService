import { ProviderResult } from '../../domain/email-provider.interface';
import { WhatsAppProvider } from '../../domain/whatsapp-provider.interface';
import { AppLoggerService } from '../../../../shared/infrastructure/logger/logger.service';

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
  private readonly logger: AppLoggerService;

  constructor(config: WhatsAppCloudAdapterConfig, logger?: AppLoggerService) {
    this.phoneNumberId = config.phoneNumberId;
    this.accessToken = config.accessToken;
    this.apiVersion = config.apiVersion ?? 'v21.0';
    this.logger = logger ?? new AppLoggerService();
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
    const start = Date.now();
    const messageType = payload.type as string | undefined;
    this.logger.log('WhatsApp Cloud API attempt', {
      type: 'provider_send',
      provider: 'WHATSAPP_CLOUD',
      to: payload.to,
      messageType,
    });
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
        this.logger.log('WhatsApp Cloud API success', {
          type: 'provider_send',
          provider: 'WHATSAPP_CLOUD',
          to: payload.to,
          messageType,
          providerMessageId: messageId,
          durationMs: Date.now() - start,
        });
        return {
          success: true,
          providerMessageId: messageId,
        };
      }

      const error = (data as MetaErrorResponse).error;
      this.logger.error('WhatsApp Cloud API rejected the message', undefined, {
        type: 'provider_send',
        provider: 'WHATSAPP_CLOUD',
        to: payload.to,
        messageType,
        httpStatus: response.status,
        metaErrorCode: error?.code,
        metaErrorType: error?.type,
        errorMessage:
          error?.error_data?.details ?? error?.message ?? response.statusText,
        durationMs: Date.now() - start,
      });
      return {
        success: false,
        errorType: `HTTP_${response.status}`,
        errorMessage:
          error?.error_data?.details ??
          error?.message ??
          `WhatsApp Cloud API error: ${response.statusText}`,
      };
    } catch (err) {
      this.logger.error(
        'WhatsApp Cloud API network error (timeout/unreachable?)',
        err instanceof Error ? err.stack : String(err),
        {
          type: 'provider_send',
          provider: 'WHATSAPP_CLOUD',
          to: payload.to,
          messageType,
          durationMs: Date.now() - start,
          errorMessage: err instanceof Error ? err.message : 'Unknown error',
        },
      );
      return {
        success: false,
        errorType: 'NETWORK_ERROR',
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }
}
