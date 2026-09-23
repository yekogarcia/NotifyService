import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { ApplicationEntity } from '../../../applications/domain/entities/application.entity';
import { TenantRepository } from '../../../tenants/domain/repositories';
import { OAuthTokenRepositoryToken } from '../../domain/repositories/oauth-token.repository';
import type { OAuthTokenRepository } from '../../domain/repositories/oauth-token.repository';

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
}

@Injectable()
export class OAuthTokenUseCase {
  private readonly REFRESH_TOKEN_EXPIRY_DAYS = 30;
  private readonly ACCESS_TOKEN_EXPIRY_SECONDS = 3600;

  constructor(
    @InjectRepository(ApplicationEntity)
    private readonly appRepo: Repository<ApplicationEntity>,
    @Inject('TenantRepository')
    private readonly tenantRepo: TenantRepository,
    @Inject(OAuthTokenRepositoryToken)
    private readonly oauthTokenRepo: OAuthTokenRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(
    grantType: 'client_credentials' | 'password',
    params: {
      client_id?: string;
      client_secret?: string;
      username?: string;
      password?: string;
    },
  ): Promise<OAuthTokenResponse> {
    switch (grantType) {
      case 'client_credentials':
        return this.handleClientCredentials(params);
      case 'password':
        return this.handlePassword(params);
      default:
        throw new BadRequestException(`Unsupported grant_type: ${grantType}`);
    }
  }

  async executeRefresh(params: {
    client_id: string;
    client_secret: string;
    refresh_token: string;
  }): Promise<OAuthTokenResponse> {
    return this.handleRefreshToken(params);
  }

  private async handleClientCredentials(params: {
    client_id?: string;
    client_secret?: string;
  }): Promise<OAuthTokenResponse> {
    if (!params.client_id || !params.client_secret) {
      throw new BadRequestException(
        'client_id and client_secret are required for client_credentials grant',
      );
    }

    const app = await this.validateApplication(
      params.client_id,
      params.client_secret,
    );

    const payload = {
      type: 'api',
      sub: app.id,
      tenantId: app.tenantId,
      clientId: app.clientId,
      appName: app.name,
    };

    return this.generateTokens(
      payload,
      app.tenantId,
      app.id,
      null,
      'client_credentials',
    );
  }

  private async handlePassword(params: {
    client_id?: string;
    client_secret?: string;
    username?: string;
    password?: string;
  }): Promise<OAuthTokenResponse> {
    if (!params.username || !params.password) {
      throw new BadRequestException(
        'username and password are required for password grant',
      );
    }

    const tenant = await this.tenantRepo.findByEmail(params.username);
    if (!tenant || !tenant.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatch = await argon2.verify(tenant.password, params.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      type: 'admin',
      sub: tenant.id,
      tenantId: tenant.id,
      email: tenant.email,
      tenantName: tenant.name,
    };

    return this.generateTokens(payload, tenant.id, null, tenant.id, 'password');
  }

  private async handleRefreshToken(params: {
    client_id?: string;
    client_secret?: string;
    refresh_token?: string;
  }): Promise<OAuthTokenResponse> {
    if (!params.client_id || !params.client_secret || !params.refresh_token) {
      throw new BadRequestException(
        'client_id, client_secret and refresh_token are required for refresh_token grant',
      );
    }

    const app = await this.validateApplication(
      params.client_id,
      params.client_secret,
    );

    const storedToken = await this.oauthTokenRepo.findByRefreshToken(
      params.refresh_token,
    );

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (storedToken.revokedAt) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (new Date() > storedToken.expiresAt) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    if (storedToken.applicationId && storedToken.applicationId !== app.id) {
      throw new UnauthorizedException(
        'Refresh token does not belong to this application',
      );
    }

    await this.oauthTokenRepo.revoke(params.refresh_token);

    if (storedToken.grantType === 'client_credentials') {
      const payload = {
        type: 'api',
        sub: app.id,
        tenantId: app.tenantId,
        clientId: app.clientId,
        appName: app.name,
      };

      return this.generateTokens(
        payload,
        app.tenantId,
        app.id,
        null,
        'client_credentials',
      );
    }

    if (storedToken.grantType === 'password' && storedToken.userId) {
      const tenant = await this.tenantRepo.findById(storedToken.userId);
      if (!tenant || !tenant.isActive) {
        throw new UnauthorizedException('Tenant not found or inactive');
      }

      const payload = {
        type: 'admin',
        sub: tenant.id,
        tenantId: tenant.id,
        email: tenant.email,
        tenantName: tenant.name,
      };

      return this.generateTokens(
        payload,
        tenant.id,
        null,
        tenant.id,
        'password',
      );
    }

    throw new UnauthorizedException('Unable to refresh token');
  }

  private async validateApplication(
    clientId: string,
    clientSecret: string,
  ): Promise<ApplicationEntity> {
    const app = await this.appRepo.findOne({ where: { clientId } });

    if (!app || !app.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const secretMatch = await argon2.verify(app.clientSecret, clientSecret);
    if (!secretMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return app;
  }

  private async generateTokens(
    payload: Record<string, unknown>,
    tenantId: string,
    applicationId: string | null,
    userId: string | null,
    grantType: string,
  ): Promise<OAuthTokenResponse> {
    const accessToken = this.jwtService.sign(payload);

    const refreshToken = crypto.randomBytes(64).toString('base64url');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.REFRESH_TOKEN_EXPIRY_DAYS);

    await this.oauthTokenRepo.create({
      tenantId,
      applicationId,
      userId,
      refreshToken,
      grantType,
      expiresAt,
    });

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.ACCESS_TOKEN_EXPIRY_SECONDS,
      refresh_token: refreshToken,
    };
  }
}
