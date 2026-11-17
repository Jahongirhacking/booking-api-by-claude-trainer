import './env';

/**
 * Barcha testlardan oldin BIR marta:
 *  1) test bazasini tozalaydi (dropDatabase),
 *  2) migratsiyalarni noldan ishga tushiradi.
 * Shu tariqa sxema FAQAT migratsiyalar orqali yaratilishi tekshiriladi.
 */
export default async function globalSetup(): Promise<void> {
  const { default: dataSource } = await import('../../src/database/data-source');

  await dataSource.initialize();
  try {
    await dataSource.dropDatabase();
    await dataSource.runMigrations();
  } finally {
    await dataSource.destroy();
  }
}
