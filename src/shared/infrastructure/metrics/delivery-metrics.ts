import { Injectable } from '@nestjs/common';

export interface DeliveryStats {
  sent: number;
  failed: number;
  retried: number;
  totalDurationMs: number;
  deliveryCount: number;
  failuresByErrorType: Record<string, number>;
}

@Injectable()
export class DeliveryMetricsService {
  private sent = 0;
  private failed = 0;
  private retried = 0;
  private totalDurationMs = 0;
  private deliveryCount = 0;
  private readonly failuresByErrorType: Record<string, number> = {};

  recordSent(deliveryId: string): void {
    this.sent += 1;
    this.deliveryCount += 1;
    void deliveryId;
  }

  recordFailed(deliveryId: string, errorType: string): void {
    this.failed += 1;
    this.failuresByErrorType[errorType] =
      (this.failuresByErrorType[errorType] ?? 0) + 1;
    void deliveryId;
  }

  recordRetried(deliveryId: string): void {
    this.retried += 1;
    void deliveryId;
  }

  recordDuration(deliveryId: string, ms: number): void {
    this.totalDurationMs += ms;
    void deliveryId;
  }

  getStats(): DeliveryStats {
    return {
      sent: this.sent,
      failed: this.failed,
      retried: this.retried,
      totalDurationMs: this.totalDurationMs,
      deliveryCount: this.deliveryCount,
      failuresByErrorType: { ...this.failuresByErrorType },
    };
  }
}
