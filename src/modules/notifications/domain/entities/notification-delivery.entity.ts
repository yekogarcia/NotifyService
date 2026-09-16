import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { DeliveryStatus, ChannelType } from '../enums';
import { NotificationEntity } from './notification.entity';
import { NotificationRecipientEntity } from './notification-recipient.entity';
import { NotificationAttemptEntity } from './notification-attempt.entity';

@Entity('notification_deliveries')
@Index('idx_delivery_status', ['status'])
@Index('idx_delivery_recipient_channel', ['recipientId', 'channel'])
export class NotificationDeliveryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'notification_id' })
  notificationId!: string;

  @Column({ type: 'uuid', name: 'recipient_id' })
  recipientId!: string;

  @Column({ type: 'varchar', length: 20 })
  channel!: ChannelType;

  @Column({ type: 'uuid', name: 'provider_id', nullable: true })
  providerId!: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: DeliveryStatus.CREATED,
  })
  status!: DeliveryStatus;

  @Column({ type: 'int', name: 'attempt_count', default: 0 })
  attemptCount!: number;

  @Column({ type: 'int', name: 'max_attempts', default: 3 })
  maxAttempts!: number;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'provider_message_id',
    nullable: true,
  })
  providerMessageId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => NotificationEntity, (n) => n.deliveries)
  @JoinColumn({ name: 'notification_id' })
  notification!: NotificationEntity;

  @ManyToOne(() => NotificationRecipientEntity)
  @JoinColumn({ name: 'recipient_id' })
  recipient!: NotificationRecipientEntity;

  @OneToMany(
    () => NotificationAttemptEntity,
    (a) => a.delivery,
  )
  attempts!: NotificationAttemptEntity[];
}
