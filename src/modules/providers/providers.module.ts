import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationProviderEntity } from './domain/entities/provider.entity';
import { ProviderController } from './interfaces/controllers/provider.controller';
import { ProviderRegistry } from './application/provider-registry';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationProviderEntity]),
  ],
  controllers: [ProviderController],
  providers: [ProviderRegistry],
  exports: [ProviderRegistry],
})
export class ProvidersModule {}
