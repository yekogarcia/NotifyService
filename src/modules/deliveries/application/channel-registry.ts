import { Injectable } from '@nestjs/common';
import { ChannelType } from '../../notifications/domain/enums';
import { NotificationChannel } from '../domain/channel.interface';
import { EmailChannel } from '../infrastructure/channels/email.channel';
import { SmsChannel } from '../infrastructure/channels/sms.channel';
import { PushChannel } from '../infrastructure/channels/push.channel';
import { WhatsappChannel } from '../infrastructure/channels/whatsapp.channel';

@Injectable()
export class ChannelRegistry {
  private readonly channels: Map<ChannelType, NotificationChannel>;

  constructor(
    private readonly emailChannel: EmailChannel,
    private readonly smsChannel: SmsChannel,
    private readonly pushChannel: PushChannel,
    private readonly whatsappChannel: WhatsappChannel,
  ) {
    this.channels = new Map<ChannelType, NotificationChannel>([
      [ChannelType.EMAIL, this.emailChannel],
      [ChannelType.SMS, this.smsChannel],
      [ChannelType.PUSH, this.pushChannel],
      [ChannelType.WHATSAPP, this.whatsappChannel],
    ]);
  }

  getChannel(channelType: ChannelType): NotificationChannel {
    const channel = this.channels.get(channelType);
    if (!channel) {
      throw new Error(`No channel registered for channel type: ${channelType}`);
    }
    return channel;
  }
}
