import * as admin from 'firebase-admin';
import { randomUUID } from 'crypto';
import { ProviderResult } from '../../domain/email-provider.interface';
import { PushProvider } from '../../domain/push-provider.interface';
import { AppLoggerService } from '../../../../shared/infrastructure/logger/logger.service';

export interface FcmAdapterConfig {
  serviceAccountKey: admin.ServiceAccount;
}

export class FcmAdapter implements PushProvider {
  private readonly app: admin.app.App;
  private readonly logger: AppLoggerService;

  constructor(config: FcmAdapterConfig, logger?: AppLoggerService) {
    this.app = admin.initializeApp(
      {
        credential: admin.credential.cert(config.serviceAccountKey),
      },
      `fcm-${randomUUID()}`,
    );
    this.logger = logger ?? new AppLoggerService();
  }

  async sendPush(
    deviceToken: string,
    title: string,
    body: string,
  ): Promise<ProviderResult> {
    const start = Date.now();
    this.logger.log('FCM sendPush attempt', {
      type: 'provider_send',
      provider: 'FCM',
      to: deviceToken,
      title,
    });
    try {
      const messageId = await admin.messaging(this.app).send({
        token: deviceToken,
        notification: { title, body },
      });
      this.logger.log('FCM sendPush success', {
        type: 'provider_send',
        provider: 'FCM',
        to: deviceToken,
        providerMessageId: messageId,
        durationMs: Date.now() - start,
      });
      return {
        success: true,
        providerMessageId: messageId,
      };
    } catch (error) {
      this.logger.error(
        'FCM sendPush failed',
        error instanceof Error ? error.stack : String(error),
        {
          type: 'provider_send',
          provider: 'FCM',
          to: deviceToken,
          durationMs: Date.now() - start,
          errorType:
            error instanceof Error ? error.constructor.name : 'UnknownError',
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
        },
      );
      return {
        success: false,
        errorType:
          error instanceof Error ? error.constructor.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
