import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const production = config.get('NODE_ENV') === 'production';

  app.setGlobalPrefix('api');
  app.use(
    helmet({
      // The API answers JSON and files (the only HTML is Swagger, outside production), and a
      // policy on a PDF response can break the browser's own viewer
      contentSecurityPolicy: false,
      // Scanned PDFs open in the site's reader and covers load from the web origin
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // Caddy and Cloudflare own HSTS
      strictTransportSecurity: false,
      // The site embeds scanned PDFs from /api/scans in a frame
      xFrameOptions: { action: 'sameorigin' },
    }),
  );
  app.enableCors({
    origin: config.get('CORS_ORIGIN', 'http://localhost:3000'),
    // Reader sessions are a cookie; in production the API is same-origin (/api), in
    // development the web app on another port sends it with credentials: 'include'
    credentials: true,
  });
  // Behind Caddy on a private network: its X-Forwarded-* count for req.ip and req.protocol,
  // a public peer's do not (see clientIp for how the visitor's address is found)
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');
  app.useBodyParser('json', { limit: '2mb' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  // SIGTERM from Docker: close the server, timers and the database pool before exiting
  app.enableShutdownHooks();

  if (!production) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Kitabxana.az API')
      .setDescription('Azerbaijani Cultural Heritage Portal')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const doc = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, doc);
  }

  const port = config.get('PORT', 4000);
  await app.listen(port);
  console.log(`Kitabxana.az API running on http://localhost:${port}`);
}
bootstrap();
