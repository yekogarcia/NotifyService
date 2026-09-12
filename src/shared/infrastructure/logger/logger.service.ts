import { Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';

const { combine, timestamp, json, errors } = winston.format;

@Injectable()
export class AppLoggerService implements LoggerService {
  private readonly logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL ?? 'info',
      format: combine(
        errors({ stack: true }),
        timestamp(),
        json(),
      ),
      defaultMeta: { service: 'notitify-service' },
      transports: [
        new winston.transports.Console({
          format: combine(
            timestamp(),
            json(),
          ),
        }),
      ],
    });
  }

  log(message: string, context?: Record<string, unknown>): void {
    this.logger.info(message, context);
  }

  error(
    message: string,
    trace?: unknown,
    context?: Record<string, unknown>,
  ): void {
    this.logger.error(message, { ...context, trace });
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.logger.warn(message, context);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.logger.debug(message, context);
  }

  verbose(message: string, context?: Record<string, unknown>): void {
    this.logger.verbose(message, context);
  }
}
