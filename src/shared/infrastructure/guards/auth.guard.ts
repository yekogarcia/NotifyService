import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';

type AuthenticatedRequest = FastifyRequest & {
  tenantId?: string;
};

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly apiKey: string;
  private readonly jwtSecret: string;

  constructor() {
    this.apiKey = process.env.API_KEY ?? 'dev-api-key';
    this.jwtSecret = process.env.JWT_SECRET ?? 'dev-jwt-secret';
  }

  canActivate(context: ExecutionContext): boolean {
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
        request.tenantId = 'default-tenant';
        return true;
      }
    }

    if (process.env.NODE_ENV === 'test') {
      request.tenantId = 'default-tenant';
      return true;
    }

    throw new UnauthorizedException(
      'Valid API key or JWT token required',
    );
  }
}
