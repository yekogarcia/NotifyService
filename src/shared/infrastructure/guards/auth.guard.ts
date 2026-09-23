import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { FastifyRequest } from 'fastify';
import { IS_PUBLIC_KEY } from './public.decorator';

export type AuthenticatedRequest = FastifyRequest & {
  user?: {
    type: 'api' | 'admin';
    sub: string;
    tenantId: string;
    clientId?: string;
    appName?: string;
    email?: string;
    tenantName?: string;
  };
  tenantId?: string;
};

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly apiKey: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {
    this.apiKey = process.env.API_KEY ?? 'dev-api-key';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const apiKey = request.headers['x-api-key'] as string | undefined;
    const authHeader = request.headers['authorization'] as string | undefined;

    if (apiKey && apiKey === this.apiKey) {
      request.tenantId = 'default-tenant';
      return true;
    }

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (token) {
        try {
          const payload = await this.jwtService.verifyAsync(token);

          if (payload.type === 'admin') {
            request.user = {
              type: 'admin',
              sub: payload.sub,
              tenantId: payload.sub,
              email: payload.email,
              tenantName: payload.tenantName,
            };
            request.tenantId = payload.sub;
          } else {
            request.user = {
              type: 'api',
              sub: payload.sub,
              tenantId: payload.tenantId,
              clientId: payload.clientId,
              appName: payload.appName,
            };
            request.tenantId = payload.tenantId;
          }

          return true;
        } catch {
          throw new UnauthorizedException('Invalid or expired token');
        }
      }
    }

    if (process.env.NODE_ENV === 'test') {
      request.tenantId = 'default-tenant';
      return true;
    }

    throw new UnauthorizedException('Valid API key or JWT token required');
  }
}
