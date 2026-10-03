import { Injectable, Inject } from '@nestjs/common';
import {
  NotificationChannel,
  SendContext,
  SendResult,
} from '../../domain/channel.interface';
import { PushProvider } from '../../../providers/domain/push-provider.interface';
import { ProviderRegistry } from '../../../providers/application/provider-registry';
import { ChannelType } from '../../../notifications/domain/enums';
import { AppLoggerService } from '../../../../shared/infrastructure/logger/logger.service';

@Injectable()
export class PushChannel implements NotificationChannel {
  constructor(
    private readonly registry: ProviderRegistry,
    @Inject('PushProvider') private readonly fallback: PushProvider,
    private readonly logger: AppLoggerService = new AppLoggerService(),
  ) {}

  async send(context: SendContext): Promise<SendResult> {
    const resolved = await this.registry.resolve(
      context.tenantId,
      ChannelType.PUSH,
    );
    const candidate = resolved?.provider ?? this.fallback;

    this.logger.log('Sending via PUSH channel', {
      deliveryId: context.deliveryId,
      providerSource: resolved ? 'tenant_registry' : 'env_fallback',
    });

    if (!this.isPushProvider(candidate)) {
      this.logger.error(
        'Resolved provider for PUSH is not a push provider',
        undefined,
        {
          deliveryId: context.deliveryId,
          providerSource: resolved ? 'tenant_registry' : 'env_fallback',
        },
      );
      return {
        success: false,
        errorType: 'ConfigurationError',
        errorMessage: `Resolved provider for PUSH is not a push provider`,
      };
    }

    const result = await candidate.sendPush(
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

  private isPushProvider(provider: unknown): provider is PushProvider {
    return typeof (provider as PushProvider)?.sendPush === 'function';
  }
}
