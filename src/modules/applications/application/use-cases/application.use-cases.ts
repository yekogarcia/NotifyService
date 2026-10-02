import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApplicationRepository } from '../../domain/repositories';
import { ApplicationEntity } from '../../domain/entities/application.entity';
import { NotificationEntity } from '../../../notifications/domain/entities/notification.entity';
import { NotificationTemplateEntity } from '../../../templates/domain/entities/template.entity';
import { PreferenceEntity } from '../../../preferences/domain/entities/preference.entity';
import { DeviceEntity } from '../../../preferences/domain/entities/device.entity';
import { NotificationEventEntity } from '../../../notifications/domain/entities/notification-event.entity';
import { OAuthTokenEntity } from '../../../auth/domain/entities/oauth-token.entity';
import {
  CreateApplicationDTO,
  UpdateApplicationDTO,
} from '../dto/application.dto';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';

@Injectable()
export class GenerateCredentialsUseCase {
  generateClientId(): string {
    return `app_${crypto.randomBytes(16).toString('hex')}`;
  }

  generateClientSecret(): string {
    return `sec_${crypto.randomBytes(32).toString('hex')}`;
  }

  async hashSecret(secret: string): Promise<string> {
    return argon2.hash(secret, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  }
}

@Injectable()
export class CreateApplicationUseCase {
  constructor(
    @Inject('ApplicationRepository')
    private readonly appRepo: ApplicationRepository,
    private readonly credentials: GenerateCredentialsUseCase,
  ) {}

  async execute(
    tenantId: string,
    dto: CreateApplicationDTO,
  ): Promise<{
    application: {
      id: string;
      tenantId: string;
      name: string;
      clientId: string;
      isActive: boolean;
      createdAt: Date;
    };
    credentials: { clientId: string; clientSecret: string };
    message: string;
  }> {
    const clientId = this.credentials.generateClientId();
    const clientSecretPlain = this.credentials.generateClientSecret();
    const clientSecretHashed =
      await this.credentials.hashSecret(clientSecretPlain);

    const app = new ApplicationEntity();
    app.tenantId = tenantId;
    app.name = dto.name;
    app.clientId = clientId;
    app.clientSecret = clientSecretHashed;
    app.isActive = true;

    const saved = await this.appRepo.save(app);

    return {
      application: {
        id: saved.id,
        tenantId: saved.tenantId,
        name: saved.name,
        clientId,
        isActive: saved.isActive,
        createdAt: saved.createdAt,
      },
      credentials: {
        clientId,
        clientSecret: clientSecretPlain,
      },
      message:
        'IMPORTANT: Save these credentials securely. The client_secret will NOT be shown again.',
    };
  }
}

@Injectable()
export class GetApplicationsUseCase {
  constructor(
    @Inject('ApplicationRepository')
    private readonly appRepo: ApplicationRepository,
  ) {}

  async execute(tenantId: string): Promise<ApplicationEntity[]> {
    return this.appRepo.findByTenantId(tenantId);
  }
}

@Injectable()
export class GetApplicationByIdUseCase {
  constructor(
    @Inject('ApplicationRepository')
    private readonly appRepo: ApplicationRepository,
  ) {}

  async execute(tenantId: string, id: string): Promise<ApplicationEntity> {
    const app = await this.appRepo.findById(id);
    if (!app || app.tenantId !== tenantId) {
      throw new NotFoundException(`Application with id "${id}" not found`);
    }
    return app;
  }
}

@Injectable()
export class UpdateApplicationUseCase {
  constructor(
    @Inject('ApplicationRepository')
    private readonly appRepo: ApplicationRepository,
  ) {}

  async execute(
    tenantId: string,
    id: string,
    dto: UpdateApplicationDTO,
  ): Promise<ApplicationEntity> {
    const app = await this.appRepo.findById(id);
    if (!app || app.tenantId !== tenantId) {
      throw new NotFoundException(`Application with id "${id}" not found`);
    }

    const updated = await this.appRepo.update(id, dto);
    return updated!;
  }
}

@Injectable()
export class DeleteApplicationUseCase {
  constructor(
    @Inject('ApplicationRepository')
    private readonly appRepo: ApplicationRepository,
    private readonly dataSource: DataSource,
  ) {}

  async execute(tenantId: string, id: string): Promise<void> {
    const app = await this.appRepo.findById(id);
    if (!app || app.tenantId !== tenantId) {
      throw new NotFoundException(`Application with id "${id}" not found`);
    }
    // Solo se puede eliminar si no está asociada a nada. Los FK son
    // ON DELETE CASCADE: borrar sin este cheque arrastraría notificaciones,
    // plantillas, preferencias, dispositivos, eventos y tokens.
    const blocking = await this.findAssociations(id);
    const entries = Object.entries(blocking).filter(([, count]) => count > 0);
    if (entries.length > 0) {
      const detail = entries
        .map(([key, count]) => `${key} (${count})`)
        .join(', ');
      throw new ConflictException({
        message: `Cannot delete application with associated records: ${detail}`,
        blocking: Object.fromEntries(entries),
      });
    }
    await this.appRepo.delete(id);
  }

  private async findAssociations(
    applicationId: string,
  ): Promise<Record<string, number>> {
    const where = { where: { applicationId } };
    const [notifications, templates, preferences, devices, events, tokens] =
      await Promise.all([
        this.dataSource.getRepository(NotificationEntity).count(where),
        this.dataSource.getRepository(NotificationTemplateEntity).count(where),
        this.dataSource.getRepository(PreferenceEntity).count(where),
        this.dataSource.getRepository(DeviceEntity).count(where),
        this.dataSource.getRepository(NotificationEventEntity).count(where),
        this.dataSource.getRepository(OAuthTokenEntity).count(where),
      ]);
    return { notifications, templates, preferences, devices, events, tokens };
  }
}

@Injectable()
export class RotateSecretUseCase {
  constructor(
    @Inject('ApplicationRepository')
    private readonly appRepo: ApplicationRepository,
    private readonly credentials: GenerateCredentialsUseCase,
  ) {}

  async execute(
    tenantId: string,
    id: string,
  ): Promise<{
    credentials: { clientId: string; clientSecret: string };
    message: string;
  }> {
    const app = await this.appRepo.findById(id);
    if (!app || app.tenantId !== tenantId) {
      throw new NotFoundException(`Application with id "${id}" not found`);
    }

    const newSecret = this.credentials.generateClientSecret();
    const hashed = await this.credentials.hashSecret(newSecret);

    await this.appRepo.update(id, { clientSecret: hashed });

    return {
      credentials: {
        clientId: app.clientId,
        clientSecret: newSecret,
      },
      message:
        'IMPORTANT: Save these credentials. The previous client_secret has been invalidated.',
    };
  }
}
