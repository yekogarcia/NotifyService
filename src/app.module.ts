import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { HealthModule } from './modules/health/health.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DeliveriesModule } from './modules/deliveries/deliveries.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { PreferencesModule } from './modules/preferences/preferences.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { AuthModule } from './modules/auth/auth.module';
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
import { ProviderChannelEntity } from './modules/providers/domain/entities/provider-channel.entity';
import { PreferenceEntity } from './modules/preferences/domain/entities/preference.entity';
import { DeviceEntity } from './modules/preferences/domain/entities/device.entity';
import { TenantEntity } from './modules/tenants/domain/entities/tenant.entity';
import { ApplicationEntity } from './modules/applications/domain/entities/application.entity';
import { OAuthTokenEntity } from './modules/auth/domain/entities/oauth-token.entity';
import { AuthGuard } from './shared/infrastructure/guards/auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres' as const,
        url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/notitify',
        entities: [
          TenantEntity,
          ApplicationEntity,
          OAuthTokenEntity,
          NotificationEntity,
          NotificationRecipientEntity,
          NotificationDeliveryEntity,
          NotificationAttemptEntity,
          NotificationTemplateEntity,
          NotificationTemplateVersionEntity,
          NotificationProviderEntity,
          ProviderChannelEntity,
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
    TenantsModule,
    ApplicationsModule,
    AuthModule,
    NotificationsModule,
    DeliveriesModule,
    TemplatesModule,
    PreferencesModule,
    ProvidersModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
