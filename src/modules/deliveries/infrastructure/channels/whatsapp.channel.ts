import { Injectable, Inject } from '@nestjs/common';
import {
  NotificationChannel,
  SendContext,
  SendResult,
} from '../../domain/channel.interface';
import { WhatsAppProvider } from '../../../providers/domain/whatsapp-provider.interface';
import { ProviderRegistry } from '../../../providers/application/provider-registry';
import { ChannelType } from '../../../notifications/domain/enums';
import { AppLoggerService } from '../../../../shared/infrastructure/logger/logger.service';

@Injectable()
export class WhatsappChannel implements NotificationChannel {
  constructor(
    private readonly registry: ProviderRegistry,
    @Inject('WhatsAppProvider') private readonly fallback: WhatsAppProvider,
    private readonly logger: AppLoggerService = new AppLoggerService(),
  ) {}

  async send(context: SendContext): Promise<SendResult> {
    const resolved = await this.registry.resolve(
      context.tenantId,
      ChannelType.WHATSAPP,
    );
    const candidate = resolved?.provider ?? this.fallback;

    this.logger.log('Sending via WHATSAPP channel', {
      type: 'channel_send',
      channel: ChannelType.WHATSAPP,
      deliveryId: context.deliveryId,
      to: context.to,
      mode: context.subject ? 'template' : 'text',
      providerSource: resolved ? 'tenant_registry' : 'env_fallback',
      providerId: resolved?.providerId,
    });

    if (!this.isWhatsAppProvider(candidate)) {
      this.logger.error(
        'Resolved provider for WHATSAPP is not a WhatsApp provider',
        undefined,
        {
          type: 'channel_send',
          channel: ChannelType.WHATSAPP,
          deliveryId: context.deliveryId,
          providerSource: resolved ? 'tenant_registry' : 'env_fallback',
        },
      );
      return {
        success: false,
        errorType: 'ConfigurationError',
        errorMessage: `Resolved provider for WHATSAPP is not a WhatsApp provider`,
      };
    }

    const result = context.subject
      ? await candidate.sendTemplate(
          context.to,
          context.subject,
          context.language ?? 'es',
          context.templateParams ?? [],
        )
      : await candidate.sendText(context.to, context.body);

    return {
      success: result.success,
      providerId: resolved?.providerId,
      providerMessageId: result.providerMessageId,
      errorType: result.errorType,
      errorMessage: result.errorMessage,
    };
  }

  private isWhatsAppProvider(provider: unknown): provider is WhatsAppProvider {
    const candidate = provider as WhatsAppProvider;
    return (
      typeof candidate?.sendText === 'function' &&
      typeof candidate?.sendTemplate === 'function'
    );
  }
}
