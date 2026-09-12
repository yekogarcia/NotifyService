import { Module } from '@nestjs/common';
import { AppLoggerService } from '../logger/logger.service';

@Module({
  providers: [AppLoggerService],
  exports: [AppLoggerService],
})
export class SharedModule {}
