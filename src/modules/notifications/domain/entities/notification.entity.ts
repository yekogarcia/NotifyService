import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { NotificationStatus } from '../enums';
import { NotificationRecipientEntity } from './notification-recipient.entity';
import { NotificationDeliveryEntity } from './notification-delivery.entity';

@Entity('notifications')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'createdAt'])
export class NotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 255, name: 'source_system' })
  sourceSystem!: string;

  @Column({ type: 'varchar', length: 255, name: 'event_type' })
  eventType!: string;

  @Column({ type: 'varchar', length: 255, name: 'template_code' })
  templateCode!: string;

  @Column({ type: 'jsonb', default: '{}' })
  data!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 255, name: 'idempotency_key' })
  idempotencyKey!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: NotificationStatus.CREATED,
  })
  status!: NotificationStatus;

  @Column({ type: 'uuid', name: 'correlation_id' })
  correlationId!: string;

  @Column({ type: 'uuid', name: 'event_id', nullable: true })
  eventId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(
    () => NotificationRecipientEntity,
    (r) => r.notification,
  )
  recipients!: NotificationRecipientEntity[];

  @OneToMany(
    () => NotificationDeliveryEntity,
    (d) => d.notification,
  )
  deliveries!: NotificationDeliveryEntity[];
}
