import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthModule } from './modules/health/health.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DeliveriesModule } from './modules/deliveries/deliveries.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { PreferencesModule } from './modules/preferences/preferences.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { DatabaseModule } from './shared/infrastructure/database/database.module';
import { QueueModule } from './shared/infrastructure/queue/queue.module';
import { SharedModule } from './shared/shared.module';
import { NotificationEntity } from './modules/notifications/domain/entities/notification.entity';
import { NotificationRecipientEntity } from './modules/notifications/domain/entities/notification-recipient.entity';
import { NotificationDeliveryEntity } from './modules/notifications/domain/entities/notification-delivery.entity';
import { NotificationAttemptEntity } from './modules/notifications/domain/entities/notification-attempt.entity';
import { NotificationTemplateEntity } from './modules/templates/domain/entities/template.entity';
import { NotificationTemplateVersionEntity } from './modules/templates/domain/entities/template-version.entity';
import { NotificationProviderEntity } from './modules/providers/domain/entities/provider.entity';
import { PreferenceEntity } from './modules/preferences/domain/entities/preference.entity';
import { DeviceEntity } from './modules/preferences/domain/entities/device.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres' as const,
        url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/notitify',
        entities: [
          NotificationEntity,
          NotificationRecipientEntity,
          NotificationDeliveryEntity,
          NotificationAttemptEntity,
          NotificationTemplateEntity,
          NotificationTemplateVersionEntity,
          NotificationProviderEntity,
          PreferenceEntity,
          DeviceEntity,
        ],
        synchronize: false,
        logging: process.env.NODE_ENV === 'development',
      }),
    }),
    DatabaseModule,
    QueueModule,
    SharedModule,
    HealthModule,
    NotificationsModule,
    DeliveriesModule,
    TemplatesModule,
    PreferencesModule,
    ProvidersModule,
  ],
})
export class AppModule {}
