import { AppLoggerService } from './logger.service';

export interface NotificationLogContext {
  notificationId: string;
  sourceSystem?: string;
  eventType?: string;
}

export class NotificationLoggerService {
  private readonly context: NotificationLogContext;

  constructor(
    private readonly logger: AppLoggerService,
    context: NotificationLogContext,
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
