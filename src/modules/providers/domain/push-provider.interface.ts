import { ProviderResult } from './email-provider.interface';

export interface PushProvider {
  sendPush(
    deviceToken: string,
    title: string,
    body: string,
  ): Promise<ProviderResult>;
}
