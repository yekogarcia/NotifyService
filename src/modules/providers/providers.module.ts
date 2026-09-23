import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueueModule } from '../../shared/infrastructure/queue/queue.module';
import { NotificationProviderEntity } from './domain/entities/provider.entity';
import { ProviderChannelEntity } from './domain/entities/provider-channel.entity';
import { ProviderController } from './interfaces/controllers/provider.controller';
import { ProviderRegistry } from './application/provider-registry';
import { SecretsService } from '../../shared/infrastructure/security/secrets.service';

@Module({
  imports: [
    QueueModule,
    TypeOrmModule.forFeature([
      NotificationProviderEntity,
      ProviderChannelEntity,
    ]),
  ],
  controllers: [ProviderController],
  providers: [ProviderRegistry, SecretsService],
  exports: [ProviderRegistry, SecretsService],
})
export class ProvidersModule {}
