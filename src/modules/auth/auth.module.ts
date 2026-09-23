import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicationEntity } from '../applications/domain/entities/application.entity';
import { OAuthTokenEntity } from './domain/entities/oauth-token.entity';
import { TenantsModule } from '../tenants/tenants.module';
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy';
import { JwtAuthGuard } from './infrastructure/guards/jwt-auth.guard';
import { OAuthTokenUseCase } from './application/use-cases/oauth-token.use-case';
import { OAuthController } from './interfaces/controllers/oauth.controller';
import { OAuthTokenRepositoryToken } from './domain/repositories/oauth-token.repository';
import { TypeOrmOAuthTokenRepository } from './infrastructure/repositories/typeorm-oauth-token.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApplicationEntity, OAuthTokenEntity]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-jwt-secret',
      signOptions: { expiresIn: '1h' },
    }),
    TenantsModule,
  ],
  controllers: [OAuthController],
  providers: [
    JwtStrategy,
    JwtAuthGuard,
    OAuthTokenUseCase,
    {
      provide: OAuthTokenRepositoryToken,
      useClass: TypeOrmOAuthTokenRepository,
    },
  ],
  exports: [JwtModule, JwtAuthGuard],
})
export class AuthModule {}
