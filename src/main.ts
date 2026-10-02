import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true }),
    { bufferLogs: true, rawBody: true },
  );

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ORIGIN_URL soporta varios orígenes separados por coma y SOLO vive en el
  // entorno (.env, fuera del repo). Si falta o queda vacío se aborta el
  // arranque: CORS sin origen válido bloquearía el frontend sin rastro.
  const corsOrigins = (process.env.ORIGIN_URL ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (corsOrigins.length === 0) {
    throw new Error(
      'ORIGIN_URL is not configured: set it in the environment ' +
        '(comma-separated origins, e.g. ORIGIN_URL=https://a.example,https://b.example)',
    );
  }

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('NotifyService API')
    .setDescription('Multi-channel notification service')
    .setVersion('0.1.0')
    .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'api-key')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  Logger.log(`Application running on port ${port}`, 'Bootstrap');
  Logger.log(`Swagger UI at http://localhost:${port}/docs`, 'Bootstrap');
  Logger.log(
    `CORS enabled with ${corsOrigins.length} allowed origin(s)`,
    'Bootstrap',
  );
}

bootstrap();
