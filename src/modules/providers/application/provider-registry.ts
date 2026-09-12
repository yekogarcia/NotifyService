import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import IORedis from 'ioredis';
import { NotificationProviderEntity } from '../domain/entities/provider.entity';
import { EmailProvider } from '../domain/email-provider.interface';
import { SmsProvider } from '../domain/sms-provider.interface';
import { PushProvider } from '../domain/push-provider.interface';
import { SesAdapter } from '../infrastructure/adapters/ses.adapter';
import { TwilioAdapter } from '../infrastructure/adapters/twilio.adapter';
import { FcmAdapter } from '../infrastructure/adapters/fcm.adapter';
import { SendGridAdapter } from '../infrastructure/adapters/sendgrid.adapter';
import { InfobipAdapter } from '../infrastructure/adapters/infobip.adapter';
import { ChannelType, ProviderType } from '../../notifications/domain/enums';

interface ProviderChannelMapping {
  providerId: string;
  providerType: ProviderType;
  channel: ChannelType;
  config: Record<string, unknown>;
  secretRef: string;
}

@Injectable()
export class ProviderRegistry {
  private readonly logger = new Logger(ProviderRegistry.name);
  private cache: IORedis | null = null;

  constructor(
    @InjectRepository(NotificationProviderEntity)
    private readonly providerRepo: Repository<NotificationProviderEntity>,
  ) {}

  setCache(redis: IORedis): void {
    this.cache = redis;
  }

  async resolveProvider(
    tenantId: string,
    channel: ChannelType,
  ): Promise<EmailProvider | SmsProvider | PushProvider | null> {
    const mapping = await this.getMapping(tenantId, channel);
    if (!mapping) return null;

    return this.createAdapter(mapping);
  }

  private async getMapping(
    tenantId: string,
    channel: ChannelType,
  ): Promise<ProviderChannelMapping | null> {
    const cacheKey = `provider:${tenantId}:${channel}`;
    if (this.cache) {
      const cached = await this.cache.get(cacheKey);
      if (cached) return JSON.parse(cached) as ProviderChannelMapping;
    }

    const provider = await this.providerRepo.findOne({
      where: { tenantId, isActive: true },
    });
    if (!provider) return null;

    const mapping: ProviderChannelMapping = {
      providerId: provider.id,
      providerType: provider.providerType,
      channel,
      config: provider.config,
      secretRef: provider.secretRef,
    };

    if (this.cache) {
      await this.cache.set(cacheKey, JSON.stringify(mapping), 'EX', 300);
    }

    return mapping;
  }

  private createAdapter(
    mapping: ProviderChannelMapping,
  ): EmailProvider | SmsProvider | PushProvider {
    switch (mapping.providerType) {
      case ProviderType.SES:
        return new SesAdapter(mapping.config, mapping.secretRef);
      case ProviderType.SENDGRID:
        return new SendGridAdapter(mapping.config, mapping.secretRef);
      case ProviderType.TWILIO:
        return new TwilioAdapter(mapping.config, mapping.secretRef);
      case ProviderType.INFOBIP:
        return new InfobipAdapter(mapping.config, mapping.secretRef);
      case ProviderType.FCM:
        return new FcmAdapter(mapping.config, mapping.secretRef);
      default:
        throw new Error(`Unknown provider type: ${mapping.providerType}`);
    }
  }
}
