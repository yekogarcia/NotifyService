import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PreferenceEntity } from './domain/entities/preference.entity';
import { DeviceEntity } from './domain/entities/device.entity';
import { PreferenceResolver } from './application/preference-resolver';
import { PreferenceController } from './interfaces/controllers/preference.controller';
import { DeviceController } from './interfaces/controllers/device.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PreferenceEntity, DeviceEntity])],
  providers: [PreferenceResolver],
  controllers: [PreferenceController, DeviceController],
  exports: [PreferenceResolver],
})
export class PreferencesModule {}
