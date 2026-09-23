import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { ApplicationRepository } from '../../domain/repositories';
import { ApplicationEntity } from '../../domain/entities/application.entity';
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
  ) {}

  async execute(tenantId: string, id: string): Promise<void> {
    const app = await this.appRepo.findById(id);
    if (!app || app.tenantId !== tenantId) {
      throw new NotFoundException(`Application with id "${id}" not found`);
    }
    await this.appRepo.delete(id);
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
