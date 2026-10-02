import { Module } from '@nestjs/common';
import { DashboardService } from './application/dashboard.service';
import { DashboardController } from './interfaces/controllers/dashboard.controller';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
