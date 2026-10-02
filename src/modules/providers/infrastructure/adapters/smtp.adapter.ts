import nodemailer, { Transporter } from 'nodemailer';
import {
  EmailProvider,
  ProviderResult,
} from '../../domain/email-provider.interface';
import { AppLoggerService } from '../../../../shared/infrastructure/logger/logger.service';

export interface SmtpAdapterConfig {
  endpoint: string;
  port: number;
  username: string;
  password: string;
  fromAddress?: string;
  secure?: boolean;
  requireTLS?: boolean;
}

export class SmtpAdapter implements EmailProvider {
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly host: string;
  private readonly port: number;
  private readonly logger: AppLoggerService;

  constructor(config: SmtpAdapterConfig, logger?: AppLoggerService) {
    this.transporter = nodemailer.createTransport({
      host: config.endpoint,
      port: config.port,
      secure: config.secure ?? config.port === 465,
      requireTLS: config.requireTLS,
      auth: {
        user: config.username,
        pass: config.password,
      },
    });
    this.from = config.fromAddress ?? config.username;
    this.host = config.endpoint;
    this.port = config.port;
    this.logger = logger ?? new AppLoggerService();
  }

  async sendEmail(
    to: string,
    subject: string,
    body: string,
    from?: string,
  ): Promise<ProviderResult> {
    const sender = from?.trim() || this.from;
    if (!sender.includes('@')) {
      this.logger.error(
        'SMTP misconfigured: fromAddress is invalid',
        undefined,
        {
          type: 'provider_send',
          provider: 'SMTP',
          to,
          from: sender,
          host: this.host,
          port: this.port,
        },
      );
      return {
        success: false,
        errorType: 'ConfigurationError',
        errorMessage:
          'config.fromAddress is required (verified sender identity, e.g. contacto@semic.com.co)',
      };
    }

    const start = Date.now();
    this.logger.log('SMTP sendEmail attempt', {
      type: 'provider_send',
      provider: 'SMTP',
      to,
      from: sender,
      subject,
      host: this.host,
      port: this.port,
    });
    try {
      const info = await this.transporter.sendMail({
        from: sender,
        to,
        subject,
        html: body,
      });
      this.logger.log('SMTP sendEmail success', {
        type: 'provider_send',
        provider: 'SMTP',
        to,
        providerMessageId: info.messageId,
        durationMs: Date.now() - start,
      });
      return {
        success: true,
        providerMessageId: info.messageId,
      };
    } catch (error) {
      this.logger.error(
        'SMTP sendEmail failed ( servidor SMTP caído/inalcanzable? )',
        error instanceof Error ? error.stack : String(error),
        {
          type: 'provider_send',
          provider: 'SMTP',
          to,
          from: sender,
          host: this.host,
          port: this.port,
          durationMs: Date.now() - start,
          errorType:
            error instanceof Error ? error.constructor.name : 'UnknownError',
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
        },
      );
      return {
        success: false,
        errorType:
          error instanceof Error ? error.constructor.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
