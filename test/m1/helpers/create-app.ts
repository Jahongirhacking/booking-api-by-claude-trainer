import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../../src/app.module';
import { configureApp } from '../../../src/app.setup';

/**
 * Har bir testda toza (yangi) ilova yaratadi.
 * main.ts dagi sozlamalar configureApp() orqali ulashiladi.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  await resetDatabaseIfPresent(app);
  return app;
}

export const API = '/api/v1';

/**
 * M2 dan boshlab xizmatlar DB da saqlanadi. M1 testlari har safar bo'sh holatdan
 * boshlanishi uchun, agar TypeORM mavjud bo'lsa, jadvallarni tozalaydi.
 * M1 bosqichida (typeorm o'rnatilmagan) bu funksiya hech narsa qilmaydi.
 */
async function resetDatabaseIfPresent(app: INestApplication): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DataSource } = require('typeorm');
    const ds = app.get(DataSource, { strict: false });
    const tables = ds.entityMetadatas.map((m: { tableName: string }) => `"${m.tableName}"`);
    if (tables.length > 0) {
      await ds.query(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
    }
  } catch {
    // TypeORM yo'q yoki DataSource ro'yxatdan o'tmagan — M1 rejimi.
  }
}
