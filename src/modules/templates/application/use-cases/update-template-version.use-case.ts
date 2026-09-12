import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { NotificationTemplateVersionEntity } from '../../domain/entities/template-version.entity';

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
    channel: string,
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

  async deactivate(
    templateId: string,
    version: number,
    language: string,
    channel: string,
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
