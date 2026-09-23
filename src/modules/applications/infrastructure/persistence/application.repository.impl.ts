import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApplicationEntity } from '../../domain/entities/application.entity';
import { ApplicationRepository } from '../../domain/repositories';

@Injectable()
export class ApplicationRepositoryImpl implements ApplicationRepository {
  constructor(
    @InjectRepository(ApplicationEntity)
    private readonly repo: Repository<ApplicationEntity>,
  ) {}

  async findById(id: string): Promise<ApplicationEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByClientId(clientId: string): Promise<ApplicationEntity | null> {
    return this.repo.findOne({ where: { clientId } });
  }

  async findByTenantId(tenantId: string): Promise<ApplicationEntity[]> {
    return this.repo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async save(application: ApplicationEntity): Promise<ApplicationEntity> {
    return this.repo.save(application);
  }

  async update(
    id: string,
    data: Partial<ApplicationEntity>,
  ): Promise<ApplicationEntity | null> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repo.delete(id);
    return (result.affected ?? 0) > 0;
  }
}
