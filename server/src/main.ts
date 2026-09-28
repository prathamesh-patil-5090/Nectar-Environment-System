import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // Global prefix for all routes
  app.setGlobalPrefix('api');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // CORS — allow Next.js client
  app.enableCors({
    origin: process.env.CLIENT_URL ?? 'http://localhost:3000',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    credentials: true,
  });

  // Swagger docs
  const config = new DocumentBuilder()
    .setTitle('Nectar Enviro Ops API')
    .setDescription('REST API for the Nectar Enviro workforce management platform')
    .setVersion('1.0')
    .addTag('employees', 'Employee management')
    .addTag('leaves', 'Leave request management')
    .addTag('shifts', 'Shift rotation management')
    .addTag('training', 'Training & certification management')
    .addTag('relievers', 'Reliever pool management')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = parseInt(process.env.PORT ?? '3001', 10);
  await app.listen(port);

  // Terminal banner
  console.log('\n\x1b[36m┌────────────────────────────────────────────────────┐\x1b[0m');
  console.log('\x1b[36m│\x1b[0m  \x1b[32m🌿 Nectar Enviro — API Server\x1b[0m                       \x1b[36m│\x1b[0m');
  console.log(`\x1b[36m│\x1b[0m  \x1b[32m✅ Running on \x1b[1mhttp://localhost:${port}\x1b[0m\x1b[32m              \x1b[0m      \x1b[36m│\x1b[0m`);
  console.log(`\x1b[36m│\x1b[0m  \x1b[32m📚 Swagger docs: http://localhost:${port}/api/docs\x1b[0m   \x1b[36m│\x1b[0m`);
  console.log('\x1b[36m│\x1b[0m  \x1b[33m📦 MongoDB Atlas:  nectar_enviro\x1b[0m                    \x1b[36m│\x1b[0m');
  console.log(`\x1b[36m│\x1b[0m  \x1b[33m🛠  Environment:   ${process.env.NODE_ENV ?? 'development'}\x1b[0m                   \x1b[36m│\x1b[0m`);
  console.log('\x1b[36m└────────────────────────────────────────────────────┘\x1b[0m\n');
}

bootstrap();
