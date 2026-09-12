import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { RecipientType } from '../enums';
import { NotificationEntity } from './notification.entity';

@Entity('notification_recipients')
export class NotificationRecipientEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'notification_id' })
  notificationId: string;

  @Column({ type: 'varchar', length: 20, name: 'recipient_type' })
  recipientType: RecipientType;

  @Column({ type: 'varchar', length: 255, name: 'user_id', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => NotificationEntity, (n) => n.recipients)
  @JoinColumn({ name: 'notification_id' })
  notification: NotificationEntity;
}
