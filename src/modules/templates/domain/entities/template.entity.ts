import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Unique,
} from 'typeorm';
import { NotificationTemplateVersionEntity } from './template-version.entity';
import { TemplateStatus } from '../../../notifications/domain/enums';

@Entity('notification_templates')
@Unique('uq_template_tenant_app_code', ['tenantId', 'applicationId', 'code'])
export class NotificationTemplateEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'uuid', name: 'application_id' })
  applicationId!: string;

  @Column({ type: 'varchar', length: 255 })
  code!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 255, name: 'from_email', nullable: true })
  fromEmail!: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: TemplateStatus.ACTIVE,
  })
  status!: TemplateStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => NotificationTemplateVersionEntity, (v) => v.template)
  versions!: NotificationTemplateVersionEntity[];
}
