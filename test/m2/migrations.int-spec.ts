import { DataSource } from 'typeorm';
import dataSource from '../../src/database/data-source';

describe('M2 | Migratsiyalar (integration)', () => {
  const ds: DataSource = dataSource;

  const tableExists = async (name: string): Promise<boolean> => {
    const rows = await ds.query('SELECT to_regclass($1) AS t', [`public."${name}"`]);
    return rows[0].t !== null;
  };

  beforeAll(async () => {
    if (!ds.isInitialized) await ds.initialize();
  });

  afterAll(async () => {
    if (ds.isInitialized) {
      // Test muvaffaqiyatsiz tugasa ham, baza keyingi fayllar uchun to'liq migratsiyalangan qolsin.
      await ds.runMigrations();
      await ds.destroy();
    }
  });

  it('up(): barcha entity jadvallari mavjud, kutilayotgan migratsiya yo`q', async () => {
    for (const m of ds.entityMetadatas) {
      expect(await tableExists(m.tableName)).toBe(true);
    }
    expect(await ds.showMigrations()).toBe(false);
  });

  it('migratsiyalar entitylar bilan to`liq mos (drift yo`q)', async () => {
    const sql = await ds.driver.createSchemaBuilder().log();
    expect(sql.upQueries.map((q) => q.query)).toEqual([]);
  });

  it('down(): barcha migratsiyalar teskari qaytariladi va jadvallar o`chadi', async () => {
    const executed = ds.migrations.length;
    expect(executed).toBeGreaterThanOrEqual(1);

    for (let i = 0; i < executed; i++) {
      await ds.undoLastMigration();
    }

    for (const m of ds.entityMetadatas) {
      expect(await tableExists(m.tableName)).toBe(false);
    }
  });

  it('down() dan keyin up() qayta ishlaydi (migratsiyalar idempotent emas, lekin qaytariladigan)', async () => {
    await ds.runMigrations();

    for (const m of ds.entityMetadatas) {
      expect(await tableExists(m.tableName)).toBe(true);
    }
    expect(await ds.showMigrations()).toBe(false);
  });
});
