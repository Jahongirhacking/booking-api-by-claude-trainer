import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';

export const configureApp = (app: INestApplication) => {
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'health', method: RequestMethod.ALL }],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
};
