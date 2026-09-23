import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ChannelType } from '../../../notifications/domain/enums';

@Entity('notification_provider_channels')
@Index('uq_active_provider_per_channel', ['tenantId', 'channel'], {
  unique: true,
  where: '"is_active" = true',
})
export class ProviderChannelEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'uuid', name: 'provider_id' })
  providerId!: string;

  @Column({ type: 'varchar', length: 20 })
  channel!: ChannelType;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
