import { ApplicationEntity } from '../entities/application.entity';

export interface ApplicationRepository {
  findById(id: string): Promise<ApplicationEntity | null>;
  findByClientId(clientId: string): Promise<ApplicationEntity | null>;
  findByTenantId(tenantId: string): Promise<ApplicationEntity[]>;
  save(application: ApplicationEntity): Promise<ApplicationEntity>;
  update(
    id: string,
    data: Partial<ApplicationEntity>,
  ): Promise<ApplicationEntity | null>;
  delete(id: string): Promise<boolean>;
}
