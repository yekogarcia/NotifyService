import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ChannelType } from '../../notifications/domain/enums';
import { PreferenceEntity } from '../domain/entities/preference.entity';

@Injectable()
export class PreferenceResolver {
  constructor(
    @InjectRepository(PreferenceEntity)
    private readonly preferenceRepo: Repository<PreferenceEntity>,
  ) {}

  async resolve(
    userId: string,
    channels: ChannelType[],
  ): Promise<ChannelType[]> {
    if (channels.length === 0) {
      return [];
    }

    const tenantId = 'default-tenant';

    const preferences = await this.preferenceRepo.find({
      where: {
        tenantId,
        userId,
        channel: In(channels),
      },
    });

    const enabledByChannel = new Map(
      preferences.map((p) => [p.channel, p.enabled]),
    );

    return channels.filter((channel) => {
      const enabled = enabledByChannel.get(channel);
      return enabled === undefined ? true : enabled;
    });
  }
}
