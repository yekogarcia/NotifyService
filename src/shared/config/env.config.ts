import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/notitify',
}));

export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  password: process.env.REDIS_PASS || undefined,
}));

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiKey: process.env.API_KEY ?? 'dev-api-key',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-jwt-secret',
  defaultLanguage: process.env.DEFAULT_LANGUAGE ?? 'es',
  maxRetryAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS ?? '3', 10),
  rateLimitPerMinute: parseInt(process.env.RATE_LIMIT_PER_MINUTE ?? '100', 10),
}));

export const secretsConfig = registerAs('secrets', () => ({
  masterKey: process.env.SECRETS_MASTER_KEY,
}));
