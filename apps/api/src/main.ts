import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: config.get('CORS_ORIGIN', 'http://localhost:3000'),
    // Reader sessions are a cookie; in production the API is same-origin (/api), in
    // development the web app on another port sends it with credentials: 'include'
    credentials: true,
  });
  // Behind Caddy and Cloudflare: trust their X-Forwarded-* for req.ip and req.protocol
  app.getHttpAdapter().getInstance().set('trust proxy', true);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Kitabxana.az API')
    .setDescription('Azerbaijani Cultural Heritage Portal')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const doc = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, doc);

  const port = config.get('PORT', 4000);
  await app.listen(port);
  console.log(`Kitabxana.az API running on http://localhost:${port}`);
}
bootstrap();
