import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationTemplateVersionEntity } from '../domain/entities/template-version.entity';
import { ChannelType } from '../../notifications/domain/enums';

@Injectable()
export class LocaleResolverUseCase {
  constructor(
    @InjectRepository(NotificationTemplateVersionEntity)
    private readonly versionRepo: Repository<NotificationTemplateVersionEntity>,
  ) {}

  async resolve(
    templateId: string,
    channel: ChannelType,
    language: string,
    fallbackLanguage: string = 'es',
  ): Promise<NotificationTemplateVersionEntity | null> {
    let version = await this.versionRepo.findOne({
      where: { templateId, channel, language, isActive: true },
    });

    if (!version && language !== fallbackLanguage) {
      version = await this.versionRepo.findOne({
        where: {
          templateId,
          channel,
          language: fallbackLanguage,
          isActive: true,
        },
      });
    }

    return version;
  }
}
