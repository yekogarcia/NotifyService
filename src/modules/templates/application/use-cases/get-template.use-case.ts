import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationTemplateEntity } from '../../domain/entities/template.entity';

@Injectable()
export class GetTemplateUseCase {
  constructor(
    @InjectRepository(NotificationTemplateEntity)
    private readonly templateRepo: Repository<NotificationTemplateEntity>,
  ) {}

  async execute(
    tenantId: string,
    code: string,
  ): Promise<NotificationTemplateEntity> {
    const template = await this.templateRepo.findOne({
      where: { tenantId, code },
      relations: ['versions'],
    });

    if (!template) {
      throw new NotFoundException(`Template "${code}" not found`);
    }

    return template;
  }
}
