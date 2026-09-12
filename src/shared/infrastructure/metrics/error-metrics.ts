import { Injectable } from '@nestjs/common';

export interface ErrorStats {
  total: number;
  byErrorType: Record<string, number>;
  byProvider: Record<string, number>;
  byChannel: Record<string, number>;
  byErrorTypeProviderChannel: Record<string, number>;
}

@Injectable()
export class ErrorMetricsService {
  private total = 0;
  private readonly byErrorType: Record<string, number> = {};
  private readonly byProvider: Record<string, number> = {};
  private readonly byChannel: Record<string, number> = {};
  private readonly byErrorTypeProviderChannel: Record<string, number> = {};

  recordError(errorType: string, provider: string, channel: string): void {
    this.total += 1;

    this.byErrorType[errorType] = (this.byErrorType[errorType] ?? 0) + 1;
    this.byProvider[provider] = (this.byProvider[provider] ?? 0) + 1;
    this.byChannel[channel] = (this.byChannel[channel] ?? 0) + 1;

    const key = `${errorType}|${provider}|${channel}`;
    this.byErrorTypeProviderChannel[key] =
      (this.byErrorTypeProviderChannel[key] ?? 0) + 1;
  }

  getStats(): ErrorStats {
    return {
      total: this.total,
      byErrorType: { ...this.byErrorType },
      byProvider: { ...this.byProvider },
      byChannel: { ...this.byChannel },
      byErrorTypeProviderChannel: { ...this.byErrorTypeProviderChannel },
    };
  }
}
