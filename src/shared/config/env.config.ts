import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/notitify',
}));

export const redisConfig = registerAs('redis', () => ({
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
}));

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiKey: process.env.API_KEY ?? 'dev-api-key',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-jwt-secret',
  defaultLanguage: process.env.DEFAULT_LANGUAGE ?? 'es',
  maxRetryAttempts: parseInt(
    process.env.MAX_RETRY_ATTEMPTS ?? '3',
    10,
  ),
  rateLimitPerMinute: parseInt(
    process.env.RATE_LIMIT_PER_MINUTE ?? '100',
    10,
  ),
}));
