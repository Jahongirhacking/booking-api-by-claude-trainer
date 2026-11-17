import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../../src/app.module';
import { configureApp } from '../../../src/app.setup';
import { truncateAll } from './db';

export const API = '/api/v1';

/**
 * Yangi ilova yaratadi va (reset !== false bo'lsa) jadvallarni tozalaydi.
 * `reset: false` — "ilova qayta ishga tushganda ma'lumot saqlanadimi" testi uchun.
 */
export async function createTestApp(opts: { reset?: boolean } = {}): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  if (opts.reset !== false) {
    await truncateAll(app.get(DataSource));
  }
  return app;
}
