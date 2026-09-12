import { ProviderResult } from './email-provider.interface';

export interface SmsProvider {
  sendSms(to: string, body: string): Promise<ProviderResult>;
}
