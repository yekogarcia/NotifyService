import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { ChannelType } from '../../../notifications/domain/enums';

@Entity('notification_preferences')
@Unique('uq_preferences_tenant_user_channel', ['tenantId', 'userId', 'channel'])
export class PreferenceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 255, name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 20 })
  channel!: ChannelType;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
