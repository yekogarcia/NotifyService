import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  tenantId: string;
  clientId: string;
  appName: string;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'dev-jwt-secret',
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (!payload.tenantId || !payload.clientId) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return {
      sub: payload.sub,
      tenantId: payload.tenantId,
      clientId: payload.clientId,
      appName: payload.appName,
      iat: payload.iat,
      exp: payload.exp,
    };
  }
}
