import { OAuthTokenEntity } from '../entities/oauth-token.entity';

export const OAuthTokenRepositoryToken = Symbol('OAuthTokenRepository');

export interface OAuthTokenRepository {
  create(data: Partial<OAuthTokenEntity>): Promise<OAuthTokenEntity>;
  findByRefreshToken(refreshToken: string): Promise<OAuthTokenEntity | null>;
  revoke(refreshToken: string): Promise<void>;
  revokeAllByApplicationId(applicationId: string): Promise<void>;
  deleteExpired(): Promise<void>;
}
