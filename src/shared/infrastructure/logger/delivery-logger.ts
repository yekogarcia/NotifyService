import { AppLoggerService } from './logger.service';

export interface DeliveryLogContext {
  deliveryId: string;
  channel?: string;
  provider?: string;
  providerMessageId?: string;
}

export class DeliveryLoggerService {
  private readonly context: DeliveryLogContext;

  constructor(
    private readonly logger: AppLoggerService,
    context: DeliveryLogContext,
  ) {
    this.context = context;
  }

  log(message: string, context?: Record<string, unknown>): void {
    this.logger.log(message, { ...this.context, ...context });
  }

  error(
    message: string,
    trace?: unknown,
    context?: Record<string, unknown>,
  ): void {
    this.logger.error(message, trace, { ...this.context, ...context });
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.logger.warn(message, { ...this.context, ...context });
  }
}
