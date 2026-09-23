import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { OAuthTokenUseCase } from '../../../src/modules/auth/application/use-cases/oauth-token.use-case';

describe('OAuthTokenUseCase', () => {
  let useCase: OAuthTokenUseCase;
  let mockAppRepo: any;
  let mockTenantRepo: any;
  let mockOAuthTokenRepo: any;
  let mockJwtService: any;

  beforeEach(() => {
    mockAppRepo = {
      findOne: jest.fn(),
    };
    mockTenantRepo = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
    };
    mockOAuthTokenRepo = {
      create: jest.fn(),
      findByRefreshToken: jest.fn(),
      revoke: jest.fn(),
    };
    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    useCase = new OAuthTokenUseCase(
      mockAppRepo,
      mockTenantRepo,
      mockOAuthTokenRepo,
      mockJwtService,
    );
  });

  describe('client_credentials grant', () => {
    it('should return tokens for valid client credentials', async () => {
      const mockApp = {
        id: 'app-1',
        tenantId: 'tenant-1',
        clientId: 'app_abc123',
        clientSecret: '$argon2id$v=19$m=65536,t=3,p=4$hashed$secret',
        name: 'Test App',
        isActive: true,
      };

      mockAppRepo.findOne.mockResolvedValue(mockApp);
      jest.spyOn(require('argon2'), 'verify').mockResolvedValue(true);
      mockOAuthTokenRepo.create.mockResolvedValue({});

      const result = await useCase.execute('client_credentials', {
        client_id: 'app_abc123',
        client_secret: 'secret',
      });

      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.token_type).toBe('Bearer');
      expect(result.expires_in).toBe(3600);
      expect(result.refresh_token).toBeDefined();
    });

    it('should throw for missing client_id', async () => {
      await expect(
        useCase.execute('client_credentials', {
          client_secret: 'secret',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw for missing client_secret', async () => {
      await expect(
        useCase.execute('client_credentials', {
          client_id: 'app_abc123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw for invalid client_id', async () => {
      mockAppRepo.findOne.mockResolvedValue(null);

      await expect(
        useCase.execute('client_credentials', {
          client_id: 'invalid',
          client_secret: 'secret',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw for invalid client_secret', async () => {
      const mockApp = {
        id: 'app-1',
        clientId: 'app_abc123',
        clientSecret: '$argon2id$v=19$m=65536,t=3,p=4$hashed$secret',
        isActive: true,
      };

      mockAppRepo.findOne.mockResolvedValue(mockApp);
      jest.spyOn(require('argon2'), 'verify').mockResolvedValue(false);

      await expect(
        useCase.execute('client_credentials', {
          client_id: 'app_abc123',
          client_secret: 'wrong',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw for inactive app', async () => {
      const mockApp = {
        id: 'app-1',
        clientId: 'app_abc123',
        clientSecret: '$argon2id$v=19$m=65536,t=3,p=4$hashed$secret',
        isActive: false,
      };

      mockAppRepo.findOne.mockResolvedValue(mockApp);

      await expect(
        useCase.execute('client_credentials', {
          client_id: 'app_abc123',
          client_secret: 'secret',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('password grant', () => {
    it('should return tokens for valid admin credentials', async () => {
      const mockTenant = {
        id: 'tenant-1',
        email: 'admin@test.com',
        password: '$argon2id$v=19$m=65536,t=3,p=4$hashed$password',
        name: 'Test Tenant',
        isActive: true,
      };

      mockTenantRepo.findByEmail.mockResolvedValue(mockTenant);
      jest.spyOn(require('argon2'), 'verify').mockResolvedValue(true);
      mockOAuthTokenRepo.create.mockResolvedValue({});

      const result = await useCase.execute('password', {
        username: 'admin@test.com',
        password: 'adminpass',
      });

      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.token_type).toBe('Bearer');
      expect(result.refresh_token).toBeDefined();
    });

    it('should throw for missing username', async () => {
      await expect(
        useCase.execute('password', {
          password: 'pass',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw for missing password', async () => {
      await expect(
        useCase.execute('password', {
          username: 'admin@test.com',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw for invalid email', async () => {
      mockTenantRepo.findByEmail.mockResolvedValue(null);

      await expect(
        useCase.execute('password', {
          username: 'invalid@test.com',
          password: 'pass',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw for invalid password', async () => {
      const mockTenant = {
        id: 'tenant-1',
        email: 'admin@test.com',
        password: '$argon2id$v=19$m=65536,t=3,p=4$hashed$password',
        isActive: true,
      };

      mockTenantRepo.findByEmail.mockResolvedValue(mockTenant);
      jest.spyOn(require('argon2'), 'verify').mockResolvedValue(false);

      await expect(
        useCase.execute('password', {
          username: 'admin@test.com',
          password: 'wrong',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh_token grant', () => {
    it('should return new tokens for valid refresh token', async () => {
      const mockApp = {
        id: 'app-1',
        tenantId: 'tenant-1',
        clientId: 'app_abc123',
        clientSecret: '$argon2id$v=19$m=65536,t=3,p=4$hashed$secret',
        name: 'Test App',
        isActive: true,
      };

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const mockStoredToken = {
        id: 'token-1',
        applicationId: 'app-1',
        tenantId: 'tenant-1',
        userId: null,
        refreshToken: 'valid-refresh-token',
        grantType: 'client_credentials',
        expiresAt: futureDate,
        revokedAt: null,
      };

      mockAppRepo.findOne.mockResolvedValue(mockApp);
      jest.spyOn(require('argon2'), 'verify').mockResolvedValue(true);
      mockOAuthTokenRepo.findByRefreshToken.mockResolvedValue(mockStoredToken);
      mockOAuthTokenRepo.revoke.mockResolvedValue(undefined);
      mockOAuthTokenRepo.create.mockResolvedValue({});

      const result = await useCase.executeRefresh({
        client_id: 'app_abc123',
        client_secret: 'secret',
        refresh_token: 'valid-refresh-token',
      });

      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.refresh_token).toBeDefined();
      expect(mockOAuthTokenRepo.revoke).toHaveBeenCalledWith('valid-refresh-token');
    });

    it('should throw for missing refresh_token', async () => {
      await expect(
        useCase.executeRefresh({
          client_id: 'app_abc123',
          client_secret: 'secret',
          refresh_token: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw for invalid refresh token', async () => {
      const mockApp = {
        id: 'app-1',
        clientId: 'app_abc123',
        clientSecret: '$argon2id$v=19$m=65536,t=3,p=4$hashed$secret',
        isActive: true,
      };

      mockAppRepo.findOne.mockResolvedValue(mockApp);
      mockOAuthTokenRepo.findByRefreshToken.mockResolvedValue(null);

      await expect(
        useCase.executeRefresh({
          client_id: 'app_abc123',
          client_secret: 'secret',
          refresh_token: 'invalid-token',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw for revoked refresh token', async () => {
      const mockApp = {
        id: 'app-1',
        clientId: 'app_abc123',
        clientSecret: '$argon2id$v=19$m=65536,t=3,p=4$hashed$secret',
        isActive: true,
      };

      const mockStoredToken = {
        id: 'token-1',
        applicationId: 'app-1',
        refreshToken: 'revoked-token',
        grantType: 'client_credentials',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: new Date(),
      };

      mockAppRepo.findOne.mockResolvedValue(mockApp);
      mockOAuthTokenRepo.findByRefreshToken.mockResolvedValue(mockStoredToken);

      await expect(
        useCase.executeRefresh({
          client_id: 'app_abc123',
          client_secret: 'secret',
          refresh_token: 'revoked-token',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw for expired refresh token', async () => {
      const mockApp = {
        id: 'app-1',
        clientId: 'app_abc123',
        clientSecret: '$argon2id$v=19$m=65536,t=3,p=4$hashed$secret',
        isActive: true,
      };

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const mockStoredToken = {
        id: 'token-1',
        applicationId: 'app-1',
        refreshToken: 'expired-token',
        grantType: 'client_credentials',
        expiresAt: pastDate,
        revokedAt: null,
      };

      mockAppRepo.findOne.mockResolvedValue(mockApp);
      mockOAuthTokenRepo.findByRefreshToken.mockResolvedValue(mockStoredToken);

      await expect(
        useCase.executeRefresh({
          client_id: 'app_abc123',
          client_secret: 'secret',
          refresh_token: 'expired-token',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw for refresh token from different app', async () => {
      const mockApp = {
        id: 'app-1',
        clientId: 'app_abc123',
        clientSecret: '$argon2id$v=19$m=65536,t=3,p=4$hashed$secret',
        isActive: true,
      };

      const mockStoredToken = {
        id: 'token-1',
        applicationId: 'app-2',
        refreshToken: 'other-app-token',
        grantType: 'client_credentials',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
      };

      mockAppRepo.findOne.mockResolvedValue(mockApp);
      mockOAuthTokenRepo.findByRefreshToken.mockResolvedValue(mockStoredToken);

      await expect(
        useCase.executeRefresh({
          client_id: 'app_abc123',
          client_secret: 'secret',
          refresh_token: 'other-app-token',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('unsupported grant type', () => {
    it('should throw for unsupported grant type', async () => {
      await expect(
        useCase.execute('authorization_code' as any, {}),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
