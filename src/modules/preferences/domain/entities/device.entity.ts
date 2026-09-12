import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';
import { Platform } from '../../../notifications/domain/enums';

@Entity('notification_devices')
@Unique('uq_devices_tenant_token', ['tenantId', 'deviceToken'])
@Index('idx_devices_tenant_user', ['tenantId', 'userId'])
export class DeviceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @Column({ type: 'varchar', length: 255, name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 500, name: 'device_token' })
  deviceToken: string;

  @Column({ type: 'varchar', length: 20 })
  platform: Platform;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
