import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationTemplateVersionEntity } from '../../../../templates/domain/entities/template-version.entity';
import { ChannelType } from '../../../domain/enums';

@Injectable()
export class ValidateTemplateUseCase {
  constructor(
    @InjectRepository(NotificationTemplateVersionEntity)
    private readonly versionRepo: Repository<NotificationTemplateVersionEntity>,
  ) {}

  async execute(
    tenantId: string,
    templateCode: string,
    channels: ChannelType[],
    language: string,
  ): Promise<void> {
    for (const channel of channels) {
      const version = await this.versionRepo.findOne({
        where: {
          template: { tenantId, code: templateCode },
          language,
          channel,
          isActive: true,
        },
        relations: ['template'],
      });

      if (!version) {
        throw new NotFoundException(
          `No active template found for code "${templateCode}", channel "${channel}", language "${language}"`,
        );
      }
    }
  }
}
