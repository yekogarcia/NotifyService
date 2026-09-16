import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { AttemptResult } from '../enums';
import { NotificationDeliveryEntity } from './notification-delivery.entity';

@Entity('notification_attempts')
@Unique('uq_attempt_delivery_number', ['deliveryId', 'attemptNumber'])
export class NotificationAttemptEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'delivery_id' })
  deliveryId!: string;

  @Column({ type: 'int', name: 'attempt_number' })
  attemptNumber!: number;

  @Column({ type: 'varchar', length: 20 })
  result!: AttemptResult;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'provider_message_id',
    nullable: true,
  })
  providerMessageId!: string | null;

  @Column({ type: 'varchar', length: 100, name: 'error_type', nullable: true })
  errorType!: string | null;

  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'timestamptz', name: 'attempted_at' })
  attemptedAt!: Date;

  @ManyToOne(() => NotificationDeliveryEntity, (d) => d.attempts)
  @JoinColumn({ name: 'delivery_id' })
  delivery!: NotificationDeliveryEntity;
}
