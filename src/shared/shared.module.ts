import { Module } from '@nestjs/common';
import { AppLoggerService } from './infrastructure/logger/logger.service';

@Module({
  providers: [AppLoggerService],
  exports: [AppLoggerService],
})
export class SharedModule {}
