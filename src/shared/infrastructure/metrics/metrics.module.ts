import { Module } from '@nestjs/common';
import { DeliveryMetricsService } from './delivery-metrics';
import { ErrorMetricsService } from './error-metrics';

@Module({
  providers: [DeliveryMetricsService, ErrorMetricsService],
  exports: [DeliveryMetricsService, ErrorMetricsService],
})
export class MetricsModule {}
