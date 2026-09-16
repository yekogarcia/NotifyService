import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ProviderType } from '../../../notifications/domain/enums';

@Entity('notification_providers')
@Index('idx_provider_tenant_type', ['tenantId', 'providerType'])
export class NotificationProviderEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 50, name: 'provider_type' })
  providerType!: ProviderType;

  @Column({ type: 'jsonb', default: '{}' })
  config!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 255, name: 'secret_ref' })
  secretRef!: string;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
