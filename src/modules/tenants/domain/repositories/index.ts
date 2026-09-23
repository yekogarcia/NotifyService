import { TenantEntity } from '../entities/tenant.entity';

export interface TenantRepository {
  findById(id: string): Promise<TenantEntity | null>;
  findBySlug(slug: string): Promise<TenantEntity | null>;
  findByEmail(email: string): Promise<TenantEntity | null>;
  findAll(): Promise<TenantEntity[]>;
  save(tenant: TenantEntity): Promise<TenantEntity>;
  update(id: string, data: Partial<TenantEntity>): Promise<TenantEntity | null>;
  delete(id: string): Promise<boolean>;
}
