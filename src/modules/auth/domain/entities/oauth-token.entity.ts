import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('oauth_tokens')
@Index(['tenantId'])
@Index(['applicationId'])
export class OAuthTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'uuid', name: 'application_id', nullable: true })
  applicationId!: string | null;

  @Column({ type: 'varchar', length: 255, name: 'user_id', nullable: true })
  userId!: string | null;

  @Column({ type: 'varchar', length: 500, name: 'refresh_token' })
  refreshToken!: string;

  @Column({ type: 'varchar', length: 50, name: 'grant_type' })
  grantType!: string;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', name: 'revoked_at', nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
