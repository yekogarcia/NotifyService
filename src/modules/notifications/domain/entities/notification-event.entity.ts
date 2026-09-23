import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('notification_events')
@Index('idx_notification_event_notification_id', ['notificationId'])
@Index('idx_notification_event_correlation_id', ['correlationId'])
@Index('idx_notification_event_tenant_created', ['tenantId', 'createdAt'])
@Index('idx_events_application_id', ['applicationId'])
export class NotificationEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'uuid', name: 'application_id' })
  applicationId!: string;

  @Column({ type: 'uuid', name: 'notification_id', nullable: true })
  notificationId!: string | null;

  @Column({ type: 'uuid', name: 'delivery_id', nullable: true })
  deliveryId!: string | null;

  @Column({ type: 'varchar', length: 100, name: 'event_type' })
  eventType!: string;

  @Column({ type: 'uuid', name: 'correlation_id' })
  correlationId!: string;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'source_system',
    nullable: true,
  })
  sourceSystem!: string | null;

  @Column({ type: 'jsonb', default: '{}' })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
