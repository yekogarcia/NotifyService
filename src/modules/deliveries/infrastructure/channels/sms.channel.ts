import { Injectable, Inject } from '@nestjs/common';
import {
  NotificationChannel,
  SendContext,
  SendResult,
} from '../../domain/channel.interface';
import { SmsProvider } from '../../../providers/domain/sms-provider.interface';
import { ProviderRegistry } from '../../../providers/application/provider-registry';
import { ChannelType } from '../../../notifications/domain/enums';
import { AppLoggerService } from '../../../../shared/infrastructure/logger/logger.service';

@Injectable()
export class SmsChannel implements NotificationChannel {
  constructor(
    private readonly registry: ProviderRegistry,
    @Inject('SmsProvider') private readonly fallback: SmsProvider,
    private readonly logger: AppLoggerService = new AppLoggerService(),
  ) {}

  async send(context: SendContext): Promise<SendResult> {
    const resolved = await this.registry.resolve(
      context.tenantId,
      ChannelType.SMS,
    );
    const candidate = resolved?.provider ?? this.fallback;

    this.logger.log('Sending via SMS channel', {
      deliveryId: context.deliveryId,
      providerSource: resolved ? 'tenant_registry' : 'env_fallback',
    });

    if (!this.isSmsProvider(candidate)) {
      this.logger.error(
        'Resolved provider for SMS is not an SMS provider',
        undefined,
        {
          deliveryId: context.deliveryId,
          providerSource: resolved ? 'tenant_registry' : 'env_fallback',
        },
      );
      return {
        success: false,
        errorType: 'ConfigurationError',
        errorMessage: `Resolved provider for SMS is not an SMS provider`,
      };
    }

    const result = await candidate.sendSms(context.to, context.body);
    return {
      success: result.success,
      providerId: resolved?.providerId,
      providerMessageId: result.providerMessageId,
      errorType: result.errorType,
      errorMessage: result.errorMessage,
    };
  }

  private isSmsProvider(provider: unknown): provider is SmsProvider {
    return typeof (provider as SmsProvider)?.sendSms === 'function';
  }
}
