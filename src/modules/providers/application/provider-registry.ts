import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import IORedis from 'ioredis';
import { NotificationProviderEntity } from '../domain/entities/provider.entity';
import { ProviderChannelEntity } from '../domain/entities/provider-channel.entity';
import { EmailProvider } from '../domain/email-provider.interface';
import { SmsProvider } from '../domain/sms-provider.interface';
import { PushProvider } from '../domain/push-provider.interface';
import {
  SesAdapter,
  SesAdapterConfig,
} from '../infrastructure/adapters/ses.adapter';
import {
  TwilioAdapter,
  TwilioAdapterConfig,
} from '../infrastructure/adapters/twilio.adapter';
import {
  FcmAdapter,
  FcmAdapterConfig,
} from '../infrastructure/adapters/fcm.adapter';
import { SendGridAdapter } from '../infrastructure/adapters/sendgrid.adapter';
import { InfobipAdapter } from '../infrastructure/adapters/infobip.adapter';
import {
  SmtpAdapter,
  SmtpAdapterConfig,
} from '../infrastructure/adapters/smtp.adapter';
import { ChannelType, ProviderType } from '../../notifications/domain/enums';
import { SecretsService } from '../../../shared/infrastructure/security/secrets.service';
import { RedisService } from '../../../shared/infrastructure/queue/redis.service';

interface ProviderChannelMapping {
  providerId: string;
  providerType: ProviderType;
  channel: ChannelType;
  config: Record<string, unknown>;
  secretRef: string;
}

export interface ResolvedProvider {
  providerId: string;
  provider: EmailProvider | SmsProvider | PushProvider;
}

@Injectable()
export class ProviderRegistry {
  private cache: IORedis | null = null;

  constructor(
    @InjectRepository(NotificationProviderEntity)
    private readonly providerRepo: Repository<NotificationProviderEntity>,
    @InjectRepository(ProviderChannelEntity)
    private readonly channelRepo: Repository<ProviderChannelEntity>,
    private readonly secrets: SecretsService,
    redis: RedisService,
  ) {
    this.setCache(redis.connection);
  }

  setCache(redis: IORedis): void {
    this.cache = redis;
  }

  async resolve(
    tenantId: string,
    channel: ChannelType,
  ): Promise<ResolvedProvider | null> {
    const mapping = await this.getMapping(tenantId, channel);
    if (!mapping) return null;

    return {
      providerId: mapping.providerId,
      provider: this.createAdapter(mapping),
    };
  }

  async resolveProvider(
    tenantId: string,
    channel: ChannelType,
  ): Promise<EmailProvider | SmsProvider | PushProvider | null> {
    const resolved = await this.resolve(tenantId, channel);
    return resolved?.provider ?? null;
  }

  async invalidate(tenantId: string, channel: ChannelType): Promise<void> {
    if (!this.cache) return;
    await this.cache.del(this.cacheKey(tenantId, channel));
  }

  async invalidateForProvider(
    tenantId: string,
    providerId: string,
  ): Promise<void> {
    if (!this.cache) return;
    const mappings = await this.channelRepo.find({
      where: { tenantId, providerId },
    });
    if (mappings.length === 0) return;
    await this.cache.del(
      ...mappings.map((m) => this.cacheKey(tenantId, m.channel)),
    );
  }

  private cacheKey(tenantId: string, channel: ChannelType): string {
    return `provider:${tenantId}:${channel}`;
  }

  private async getMapping(
    tenantId: string,
    channel: ChannelType,
  ): Promise<ProviderChannelMapping | null> {
    const cacheKey = this.cacheKey(tenantId, channel);
    if (this.cache) {
      const cached = await this.cache.get(cacheKey);
      if (cached) return JSON.parse(cached) as ProviderChannelMapping;
    }

    const channelMapping = await this.channelRepo.findOne({
      where: { tenantId, channel, isActive: true },
    });
    if (!channelMapping) return null;

    const provider = await this.providerRepo.findOne({
      where: {
        id: channelMapping.providerId,
        tenantId,
        isActive: true,
      },
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
    const secret = this.secrets.decrypt(mapping.secretRef);

    switch (mapping.providerType) {
      case ProviderType.SES: {
        if (mapping.config.transport === 'smtp') {
          const fromAddress = mapping.config.fromAddress ?? mapping.config.from;
          const port = Number(mapping.config.port ?? 587);
          const password = this.secrets.isEncrypted(mapping.secretRef)
            ? this.secrets.decrypt(mapping.secretRef)
            : (process.env[mapping.secretRef] ?? '');
          return new SmtpAdapter({
            endpoint: String(
              mapping.config.host ?? mapping.config.endpoint ?? '',
            ),
            port,
            secure:
              mapping.config.secure !== undefined
                ? Boolean(mapping.config.secure)
                : port === 465,
            requireTLS:
              mapping.config.starttls !== undefined
                ? Boolean(mapping.config.starttls)
                : undefined,
            username: String(mapping.config.username ?? ''),
            password,
            fromAddress:
              fromAddress !== undefined ? String(fromAddress) : undefined,
          } satisfies SmtpAdapterConfig);
        }
        return new SesAdapter({
          ...mapping.config,
          secretRef: mapping.secretRef,
        } as SesAdapterConfig);
      }
      case ProviderType.SENDGRID:
        return new SendGridAdapter(
          { ...mapping.config, apiKey: secret },
          this.secrets.isEncrypted(mapping.secretRef)
            ? undefined
            : mapping.secretRef,
        );
      case ProviderType.TWILIO:
        return new TwilioAdapter({
          ...mapping.config,
          authToken: secret,
        } as unknown as TwilioAdapterConfig);
      case ProviderType.INFOBIP:
        return new InfobipAdapter(
          { ...mapping.config, apiKey: secret },
          this.secrets.isEncrypted(mapping.secretRef)
            ? undefined
            : mapping.secretRef,
        );
      case ProviderType.FCM:
        return new FcmAdapter({
          serviceAccountKey: mapping.config.serviceAccountKey,
        } as FcmAdapterConfig);
      case ProviderType.SMTP: {
        const fromAddress = mapping.config.fromAddress ?? mapping.config.from;
        return new SmtpAdapter({
          endpoint: String(mapping.config.endpoint ?? ''),
          port: Number(mapping.config.port ?? 587),
          username: String(mapping.config.username ?? ''),
          password: secret,
          fromAddress:
            fromAddress !== undefined ? String(fromAddress) : undefined,
        } satisfies SmtpAdapterConfig);
      }
      default:
        throw new Error(`Unknown provider type: ${mapping.providerType}`);
    }
  }
}
