import {
  Injectable,
  ConflictException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { TenantRepository } from '../../domain/repositories';
import { TenantEntity } from '../../domain/entities/tenant.entity';
import { CreateTenantDTO, UpdateTenantDTO } from '../dto/tenant.dto';
import * as argon2 from 'argon2';

function stripPassword(tenant: TenantEntity): Omit<TenantEntity, 'password'> {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    email: tenant.email,
    isActive: tenant.isActive,
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
  };
}

@Injectable()
export class CreateTenantUseCase {
  constructor(
    @Inject('TenantRepository')
    private readonly tenantRepo: TenantRepository,
  ) {}

  async execute(dto: CreateTenantDTO): Promise<Omit<TenantEntity, 'password'>> {
    const existingSlug = await this.tenantRepo.findBySlug(dto.slug);
    if (existingSlug) {
      throw new ConflictException(
        `Tenant with slug "${dto.slug}" already exists`,
      );
    }

    const existingEmail = await this.tenantRepo.findByEmail(dto.email);
    if (existingEmail) {
      throw new ConflictException(
        `Tenant with email "${dto.email}" already exists`,
      );
    }

    const hashedPassword = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const tenant = new TenantEntity();
    tenant.name = dto.name;
    tenant.slug = dto.slug;
    tenant.email = dto.email;
    tenant.password = hashedPassword;
    tenant.isActive = true;

    const saved = await this.tenantRepo.save(tenant);
    return stripPassword(saved);
  }
}

@Injectable()
export class GetTenantsUseCase {
  constructor(
    @Inject('TenantRepository')
    private readonly tenantRepo: TenantRepository,
  ) {}

  async execute(): Promise<Omit<TenantEntity, 'password'>[]> {
    const tenants = await this.tenantRepo.findAll();
    return tenants.map(stripPassword);
  }
}

@Injectable()
export class GetTenantByIdUseCase {
  constructor(
    @Inject('TenantRepository')
    private readonly tenantRepo: TenantRepository,
  ) {}

  async execute(id: string): Promise<Omit<TenantEntity, 'password'>> {
    const tenant = await this.tenantRepo.findById(id);
    if (!tenant) {
      throw new NotFoundException(`Tenant with id "${id}" not found`);
    }
    return stripPassword(tenant);
  }
}

@Injectable()
export class UpdateTenantUseCase {
  constructor(
    @Inject('TenantRepository')
    private readonly tenantRepo: TenantRepository,
  ) {}

  async execute(
    id: string,
    dto: UpdateTenantDTO,
  ): Promise<Omit<TenantEntity, 'password'>> {
    const tenant = await this.tenantRepo.findById(id);
    if (!tenant) {
      throw new NotFoundException(`Tenant with id "${id}" not found`);
    }

    const updated = await this.tenantRepo.update(id, dto);
    return stripPassword(updated!);
  }
}

@Injectable()
export class DeleteTenantUseCase {
  constructor(
    @Inject('TenantRepository')
    private readonly tenantRepo: TenantRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const tenant = await this.tenantRepo.findById(id);
    if (!tenant) {
      throw new NotFoundException(`Tenant with id "${id}" not found`);
    }
    await this.tenantRepo.delete(id);
  }
}
