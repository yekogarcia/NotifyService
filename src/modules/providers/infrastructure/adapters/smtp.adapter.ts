import nodemailer, { Transporter } from 'nodemailer';
import {
  EmailProvider,
  ProviderResult,
} from '../../domain/email-provider.interface';

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

  constructor(config: SmtpAdapterConfig) {
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
  }

  async sendEmail(
    to: string,
    subject: string,
    body: string,
  ): Promise<ProviderResult> {
    if (!this.from.includes('@')) {
      return {
        success: false,
        errorType: 'ConfigurationError',
        errorMessage:
          'config.fromAddress is required (verified sender identity, e.g. contacto@semic.com.co)',
      };
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        html: body,
      });
      return {
        success: true,
        providerMessageId: info.messageId,
      };
    } catch (error) {
      return {
        success: false,
        errorType:
          error instanceof Error ? error.constructor.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
