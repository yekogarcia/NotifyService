import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueueModule } from '../../shared/infrastructure/queue/queue.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProvidersModule } from '../providers/providers.module';
import { NotificationTemplateVersionEntity } from '../templates/domain/entities/template-version.entity';
import { SesAdapter } from '../providers/infrastructure/adapters/ses.adapter';
import { TwilioAdapter } from '../providers/infrastructure/adapters/twilio.adapter';
import { FcmAdapter } from '../providers/infrastructure/adapters/fcm.adapter';
import { PushProvider } from '../providers/domain/push-provider.interface';
import { EmailChannel } from './infrastructure/channels/email.channel';
import { SmsChannel } from './infrastructure/channels/sms.channel';
import { PushChannel } from './infrastructure/channels/push.channel';
import { ChannelRegistry } from './application/channel-registry';
import { DeliveryDispatcher } from './application/delivery-dispatcher';
import { DeliveryWorker } from './infrastructure/workers/delivery.worker';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationTemplateVersionEntity]),
    QueueModule,
    NotificationsModule,
    ProvidersModule,
  ],
  providers: [
    {
      provide: 'EmailProvider',
      useFactory: () =>
        new SesAdapter({
          region: process.env.SES_REGION ?? 'us-east-1',
          fromAddress: process.env.SES_FROM_ADDRESS ?? '',
          secretRef: process.env.SES_SECRET_REF ?? '',
        }),
    },
    {
      provide: 'SmsProvider',
      useFactory: () =>
        new TwilioAdapter({
          accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
          authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
          fromNumber: process.env.TWILIO_FROM_NUMBER ?? '',
        }),
    },
    {
      provide: 'PushProvider',
      useFactory: (): PushProvider => {
        const key = process.env.FCM_SERVICE_ACCOUNT_KEY;
        if (!key) {
          return {
            sendPush: async () => ({
              success: false,
              errorType: 'ConfigurationError',
              errorMessage: 'FCM_SERVICE_ACCOUNT_KEY is not configured',
            }),
          };
        }
        return new FcmAdapter({
          serviceAccountKey: JSON.parse(key),
        });
      },
    },
    EmailChannel,
    SmsChannel,
    PushChannel,
    ChannelRegistry,
    DeliveryDispatcher,
    DeliveryWorker,
  ],
  exports: [DeliveryDispatcher],
})
export class DeliveriesModule {}
