import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { ChannelType } from '../../../notifications/domain/enums';
import { NotificationTemplateEntity } from './template.entity';

@Entity('notification_template_versions')
@Unique('uq_version_template_ver_lang_ch', [
  'templateId',
  'version',
  'language',
  'channel',
])
export class NotificationTemplateVersionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'template_id' })
  templateId!: string;

  @Column({ type: 'int' })
  version!: number;

  @Column({ type: 'varchar', length: 10 })
  language!: string;

  @Column({ type: 'varchar', length: 20 })
  channel!: ChannelType;

  @Column({ type: 'text', nullable: true })
  subject!: string | null;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'boolean', name: 'is_active', default: false })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', name: 'activated_at', nullable: true })
  activatedAt!: Date | null;

  @ManyToOne(() => NotificationTemplateEntity, (t) => t.versions)
  @JoinColumn({ name: 'template_id' })
  template!: NotificationTemplateEntity;
}
