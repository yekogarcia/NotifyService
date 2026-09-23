import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantEntity } from '../../domain/entities/tenant.entity';
import { TenantRepository } from '../../domain/repositories';

@Injectable()
export class TenantRepositoryImpl implements TenantRepository {
  constructor(
    @InjectRepository(TenantEntity)
    private readonly repo: Repository<TenantEntity>,
  ) {}

  async findById(id: string): Promise<TenantEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findBySlug(slug: string): Promise<TenantEntity | null> {
    return this.repo.findOne({ where: { slug } });
  }

  async findByEmail(email: string): Promise<TenantEntity | null> {
    return this.repo.findOne({ where: { email } });
  }

  async findAll(): Promise<TenantEntity[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async save(tenant: TenantEntity): Promise<TenantEntity> {
    return this.repo.save(tenant);
  }

  async update(
    id: string,
    data: Partial<TenantEntity>,
  ): Promise<TenantEntity | null> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repo.delete(id);
    return (result.affected ?? 0) > 0;
  }
}
