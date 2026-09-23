import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OAuthTokenEntity } from '../../domain/entities/oauth-token.entity';
import { OAuthTokenRepository } from '../../domain/repositories/oauth-token.repository';

@Injectable()
export class TypeOrmOAuthTokenRepository implements OAuthTokenRepository {
  constructor(
    @InjectRepository(OAuthTokenEntity)
    private readonly repo: Repository<OAuthTokenEntity>,
  ) {}

  async create(data: Partial<OAuthTokenEntity>): Promise<OAuthTokenEntity> {
    const token = this.repo.create(data);
    return this.repo.save(token);
  }

  async findByRefreshToken(
    refreshToken: string,
  ): Promise<OAuthTokenEntity | null> {
    return this.repo.findOne({ where: { refreshToken } });
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.repo.update({ refreshToken }, { revokedAt: new Date() });
  }

  async revokeAllByApplicationId(applicationId: string): Promise<void> {
    await this.repo.update({ applicationId }, { revokedAt: new Date() });
  }

  async deleteExpired(): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .delete()
      .where('expires_at < :now', { now: new Date() })
      .execute();
  }
}
