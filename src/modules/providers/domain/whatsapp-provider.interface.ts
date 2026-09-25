import { ProviderResult } from './email-provider.interface';

export interface WhatsAppProvider {
  sendText(to: string, body: string): Promise<ProviderResult>;
  sendTemplate(
    to: string,
    templateName: string,
    language: string,
    params: string[],
  ): Promise<ProviderResult>;
}
