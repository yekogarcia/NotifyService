import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { NotificationTemplateVersionEntity } from '../../domain/entities/template-version.entity';
import { ChannelType } from '../../../notifications/domain/enums';

@Injectable()
export class UpdateTemplateVersionUseCase {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(NotificationTemplateVersionEntity)
    private readonly versionRepo: Repository<NotificationTemplateVersionEntity>,
  ) {}

  async activate(
    templateId: string,
    version: number,
    language: string,
    channel: ChannelType,
  ): Promise<NotificationTemplateVersionEntity> {
    return this.dataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .update(NotificationTemplateVersionEntity)
        .set({ isActive: false, activatedAt: null })
        .where('template_id = :templateId', { templateId })
        .andWhere('language = :language', { language })
        .andWhere('channel = :channel', { channel })
        .andWhere('is_active = true')
        .execute();

      const target = await manager.findOne(NotificationTemplateVersionEntity, {
        where: { templateId, version, language, channel },
      });

      if (!target) {
        throw new BadRequestException(
          `Template version ${version} for language ${language} channel ${channel} not found`,
        );
      }

      target.isActive = true;
      target.activatedAt = new Date();
      return manager.save(target);
    });
  }

  async updateContent(
    templateId: string,
    version: number,
    language: string,
    channel: ChannelType,
    input: { subject?: string | null; body?: string; language?: string; channel?: ChannelType },
  ): Promise<NotificationTemplateVersionEntity> {
    const target = await this.versionRepo.findOne({
      where: { templateId, version, language, channel },
    });

    if (!target) {
      throw new BadRequestException('Template version not found');
    }

    // Idioma/canal identifican la versión (único por template+versión+idioma+canal):
    // al cambiarlos se valida que no exista ya esa combinación.
    const nextLanguage = input.language ?? target.language;
    const nextChannel = input.channel ?? target.channel;
    if (
      nextLanguage !== target.language ||
      nextChannel !== target.channel
    ) {
      const clash = await this.versionRepo.findOne({
        where: {
          templateId,
          version: target.version,
          language: nextLanguage,
          channel: nextChannel,
        },
      });
      if (clash && clash.id !== target.id) {
        throw new ConflictException(
          `Version ${target.version} already exists for language "${nextLanguage}" channel "${nextChannel}"`,
        );
      }
      target.language = nextLanguage;
      target.channel = nextChannel;
    }

    if (input.subject !== undefined) target.subject = input.subject;
    if (input.body !== undefined) target.body = input.body;
    return this.versionRepo.save(target);
  }

  async deactivate(
    templateId: string,
    version: number,
    language: string,
    channel: ChannelType,
  ): Promise<NotificationTemplateVersionEntity> {
    const target = await this.versionRepo.findOne({
      where: { templateId, version, language, channel },
    });

    if (!target) {
      throw new BadRequestException('Template version not found');
    }

    target.isActive = false;
    target.activatedAt = null;
    return this.versionRepo.save(target);
  }
}
