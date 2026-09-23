import { Module } from '@nestjs/common';
import { AppLoggerService } from './infrastructure/logger/logger.service';
import { SecretsService } from './infrastructure/security/secrets.service';

@Module({
  providers: [AppLoggerService, SecretsService],
  exports: [AppLoggerService, SecretsService],
})
export class SharedModule {}
