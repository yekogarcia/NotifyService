import { Injectable } from '@nestjs/common';
import { ChannelType } from '../../../domain/enums';
import { RecipientDTO } from '../../dto/create-notification.dto';
import { PreferenceResolver } from '../../../../preferences/application/preference-resolver';

export interface RecipientWithChannels {
  recipient: RecipientDTO;
  channels: ChannelType[];
}

@Injectable()
export class ApplyPreferencesUseCase {
  constructor(private readonly preferenceResolver: PreferenceResolver) {}

  async execute(
    recipients: RecipientDTO[],
    channels: ChannelType[],
  ): Promise<RecipientWithChannels[]> {
    const result: RecipientWithChannels[] = [];

    for (const recipient of recipients) {
      if (!recipient.userId) {
        result.push({ recipient, channels });
        continue;
      }

      const resolvedChannels = await this.preferenceResolver.resolve(
        recipient.userId,
        channels,
      );

      if (resolvedChannels.length === 0) {
        continue;
      }

      result.push({ recipient, channels: resolvedChannels });
    }

    return result;
  }
}
