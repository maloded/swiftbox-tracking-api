import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // Flatten errors into one string so the voice agent can read it out as-is
      exceptionFactory: (errors) =>
        new BadRequestException({
          statusCode: 400,
          message: errors
            .flatMap((e) => Object.values(e.constraints ?? {}))
            .join('; '),
        }),
    }),
  );
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
