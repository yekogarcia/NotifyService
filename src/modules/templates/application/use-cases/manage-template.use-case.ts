import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationTemplateEntity } from '../../domain/entities/template.entity';
import { NotificationEntity } from '../../../notifications/domain/entities/notification.entity';
import { TemplateStatus } from '../../../notifications/domain/enums';

export interface UpdateTemplateInput {
  description?: string | null;
  status?: TemplateStatus;
  fromEmail?: string | null;
}

/**
 * Activa/desactiva y edita plantillas. El `code` es único por
 * (tenant, application): si el mismo código existe en varias apps del tenant
 * se exige `applicationId` para desambiguar.
 */
@Injectable()
export class UpdateTemplateUseCase {
  constructor(
    @InjectRepository(NotificationTemplateEntity)
    private readonly templateRepo: Repository<NotificationTemplateEntity>,
  ) {}

  async execute(
    tenantId: string,
    code: string,
    input: UpdateTemplateInput,
    applicationId?: string,
  ): Promise<NotificationTemplateEntity> {
    const template = await this.resolve(tenantId, code, applicationId);
    if (input.description !== undefined)
      template.description = input.description;
    if (input.status !== undefined) template.status = input.status;
    if (input.fromEmail !== undefined)
      template.fromEmail = input.fromEmail?.trim() || null;
    return this.templateRepo.save(template);
  }

  async resolve(
    tenantId: string,
    code: string,
    applicationId?: string,
  ): Promise<NotificationTemplateEntity> {
    const matches = await this.templateRepo.find({
      where: { tenantId, code },
      relations: ['versions'],
      order: { applicationId: 'ASC' },
    });
    if (matches.length === 0) {
      throw new NotFoundException(`Template "${code}" not found`);
    }
    if (applicationId) {
      const one = matches.find((t) => t.applicationId === applicationId);
      if (!one) {
        throw new NotFoundException(
          `Template "${code}" not found for this application`,
        );
      }
      return one;
    }
    if (matches.length > 1) {
      throw new ConflictException(
        `Code "${code}" exists in ${matches.length} applications; repeat with ?applicationId=<uuid>`,
      );
    }
    return matches[0];
  }
}

/**
 * Elimina plantilla + versiones (CASCADE) solo si ninguna notificación la usa.
 * Las notificaciones referencian por `template_code` (sin FK), así que sin
 * este cheque se rompería la trazabilidad del historial.
 */
@Injectable()
export class DeleteTemplateUseCase {
  constructor(
    @InjectRepository(NotificationTemplateEntity)
    private readonly templateRepo: Repository<NotificationTemplateEntity>,
    @InjectRepository(NotificationEntity)
    private readonly notificationRepo: Repository<NotificationEntity>,
    private readonly resolver: UpdateTemplateUseCase,
  ) {}

  async execute(
    tenantId: string,
    code: string,
    applicationId?: string,
  ): Promise<{ id: string; code: string; deleted: boolean; usage: number }> {
    const template = await this.resolver.resolve(tenantId, code, applicationId);
    const usage = await this.notificationRepo.count({
      where: {
        tenantId,
        applicationId: template.applicationId,
        templateCode: code,
      },
    });
    if (usage > 0) {
      throw new ConflictException({
        message: `Cannot delete template "${code}" with ${usage} associated notification(s)`,
        usage,
      });
    }
    // Las versiones se eliminan por CASCADE (fk_versions_template).
    await this.templateRepo.remove(template);
    return { id: template.id, code, deleted: true, usage: 0 };
  }
}
