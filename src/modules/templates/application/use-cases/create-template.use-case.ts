import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotificationTemplateEntity } from '../../domain/entities/template.entity';
import { NotificationTemplateVersionEntity } from '../../domain/entities/template-version.entity';
import { ChannelType } from '../../../notifications/domain/enums';

export interface CreateTemplateInput {
  tenantId: string;
  code: string;
  description?: string;
  versions: {
    version: number;
    language: string;
    channel: ChannelType;
    subject?: string;
    body: string;
    isActive?: boolean;
  }[];
}

@Injectable()
export class CreateTemplateUseCase {
  constructor(
    private readonly dataSource: DataSource,
  ) {}

  async execute(input: CreateTemplateInput): Promise<NotificationTemplateEntity> {
    return this.dataSource.transaction(async (manager) => {
      const template = manager.create(NotificationTemplateEntity, {
        tenantId: input.tenantId,
        code: input.code,
        description: input.description ?? null,
      });
      const saved = await manager.save(template);

      const versions = input.versions.map((v) =>
        manager.create(NotificationTemplateVersionEntity, {
          templateId: saved.id,
          version: v.version,
          language: v.language,
          channel: v.channel,
          subject: v.subject ?? null,
          body: v.body,
          isActive: v.isActive ?? false,
          activatedAt: v.isActive ? new Date() : null,
        }),
      );
      await manager.save(NotificationTemplateVersionEntity, versions);

      return saved;
    });
  }
}
