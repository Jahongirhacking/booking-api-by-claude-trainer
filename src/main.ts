import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const PORT = process.env.PORT ?? 3000;
  await app.listen(PORT);
  const logger = new Logger('Server');
  logger.log(`Server is running on http://localhost:${PORT}`);
}
bootstrap();
