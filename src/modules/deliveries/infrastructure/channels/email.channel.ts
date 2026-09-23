import { Injectable, Inject } from '@nestjs/common';
import {
  NotificationChannel,
  SendContext,
  SendResult,
} from '../../domain/channel.interface';
import { EmailProvider } from '../../../providers/domain/email-provider.interface';
import { ProviderRegistry } from '../../../providers/application/provider-registry';
import { ChannelType } from '../../../notifications/domain/enums';

@Injectable()
export class EmailChannel implements NotificationChannel {
  constructor(
    private readonly registry: ProviderRegistry,
    @Inject('EmailProvider') private readonly fallback: EmailProvider,
  ) {}

  async send(context: SendContext): Promise<SendResult> {
    const resolved = await this.registry.resolve(
      context.tenantId,
      ChannelType.EMAIL,
    );
    const candidate = resolved?.provider ?? this.fallback;

    if (!this.isEmailProvider(candidate)) {
      return {
        success: false,
        errorType: 'ConfigurationError',
        errorMessage: `Resolved provider for EMAIL is not an email provider`,
      };
    }

    const result = await candidate.sendEmail(
      context.to,
      context.subject ?? '',
      context.body,
    );
    return {
      success: result.success,
      providerId: resolved?.providerId,
      providerMessageId: result.providerMessageId,
      errorType: result.errorType,
      errorMessage: result.errorMessage,
    };
  }

  private isEmailProvider(provider: unknown): provider is EmailProvider {
    return typeof (provider as EmailProvider)?.sendEmail === 'function';
  }
}
