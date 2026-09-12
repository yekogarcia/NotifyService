import * as admin from 'firebase-admin';
import { randomUUID } from 'crypto';
import { ProviderResult } from '../../domain/email-provider.interface';
import { PushProvider } from '../../domain/push-provider.interface';

export interface FcmAdapterConfig {
  serviceAccountKey: admin.ServiceAccount;
}

export class FcmAdapter implements PushProvider {
  private readonly app: admin.app.App;

  constructor(config: FcmAdapterConfig) {
    this.app = admin.initializeApp(
      {
        credential: admin.credential.cert(config.serviceAccountKey),
      },
      `fcm-${randomUUID()}`,
    );
  }

  async sendPush(
    deviceToken: string,
    title: string,
    body: string,
  ): Promise<ProviderResult> {
    try {
      const messageId = await admin.messaging(this.app).send({
        token: deviceToken,
        notification: { title, body },
      });
      return {
        success: true,
        providerMessageId: messageId,
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
