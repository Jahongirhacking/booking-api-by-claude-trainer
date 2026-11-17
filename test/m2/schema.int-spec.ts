import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import dataSource from '../../src/database/data-source';
import {
  createBooking,
  createService,
  createStaff,
  createUser,
  sleep,
  truncateAll,
} from './helpers/db';

const UNIQUE_VIOLATION = '23505';
const FK_VIOLATION = '23503';
const CHECK_VIOLATION = '23514';

const pgError = (code: string) => ({ driverError: { code } });

describe('M2 | Sxema va entitylar (integration, haqiqiy test DB)', () => {
  const ds: DataSource = dataSource;

  beforeAll(async () => {
    if (!ds.isInitialized) await ds.initialize();
  });

  afterAll(async () => {
    if (ds.isInitialized) await ds.destroy();
  });

  beforeEach(async () => {
    await truncateAll(ds);
  });

  describe('Konfiguratsiya', () => {
    it('faqat *_test bazasiga ulangan', () => {
      expect(String(ds.options.database)).toMatch(/_test$/);
    });

    it('4 ta entity ro`yxatdan o`tgan: User, Service, Staff, Booking', () => {
      const names = ds.entityMetadatas.map((m) => m.name);
      expect(names).toEqual(expect.arrayContaining(['User', 'Service', 'Staff', 'Booking']));
    });

    it('synchronize o`chiq (sxema faqat migratsiya orqali)', () => {
      expect(ds.options.synchronize).toBeFalsy();
    });

    it('kamida bitta migratsiya bajarilgan', async () => {
      const table = ds.options.migrationsTableName ?? 'migrations';
      const rows = await ds.query(`SELECT COUNT(*)::int AS count FROM "${table}"`);
      expect(rows[0].count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('User', () => {
    it('id (uuid), default role CUSTOMER va createdAt avtomatik', async () => {
      const user = await createUser(ds);
      expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(user.role).toBe('CUSTOMER');
      expect(user.createdAt).toBeInstanceOf(Date);
    });

    it('role qiymatlari: ADMIN, STAFF, CUSTOMER', async () => {
      for (const role of ['ADMIN', 'STAFF', 'CUSTOMER']) {
        await expect(createUser(ds, { role })).resolves.toMatchObject({ role });
      }
    });

    it('noto`g`ri role DB tomonidan rad etiladi', async () => {
      await expect(createUser(ds, { role: 'SUPERHERO' })).rejects.toThrow();
    });

    it('email noyob', async () => {
      await createUser(ds, { email: 'same@test.com' });
      await expect(createUser(ds, { email: 'same@test.com' })).rejects.toMatchObject(
        pgError(UNIQUE_VIOLATION),
      );
    });
  });

  describe('Service', () => {
    it('price decimal sifatida saqlanadi, lekin JS da NUMBER qaytadi (string emas)', async () => {
      const created = await createService(ds, { price: 49999.99 });
      const found = await ds.getRepository('Service').findOneByOrFail({ id: created.id });
      expect(typeof found.price).toBe('number');
      expect(found.price).toBe(49999.99);
    });

    it('nom noyob (aynan bir xil nom)', async () => {
      await createService(ds, { name: 'Haircut' });
      await expect(createService(ds, { name: 'Haircut' })).rejects.toMatchObject(
        pgError(UNIQUE_VIOLATION),
      );
    });

    it('description ixtiyoriy (null bo`lishi mumkin)', async () => {
      const s = await createService(ds);
      const found = await ds.getRepository('Service').findOneByOrFail({ id: s.id });
      expect(found.description ?? null).toBeNull();
    });

    it('updatedAt yangilanganda o`zgaradi, createdAt o`zgarmaydi', async () => {
      const repo = ds.getRepository('Service');
      const s = await createService(ds);
      await sleep(20);
      await repo.update(s.id, { price: 999 });
      const after = await repo.findOneByOrFail({ id: s.id });

      expect(after.updatedAt.getTime()).toBeGreaterThan(s.updatedAt.getTime());
      expect(after.createdAt.getTime()).toBe(s.createdAt.getTime());
    });
  });

  describe('Staff', () => {
    it('har bir staff bitta user ga bog`langan, isActive default true', async () => {
      const staff = await createStaff(ds);
      const found = await ds
        .getRepository('Staff')
        .findOneOrFail({ where: { id: staff.id }, relations: { user: true } });

      expect(found.user.role).toBe('STAFF');
      expect(found.isActive).toBe(true);
    });

    it('bitta user ikkita staff profiliga ega bo`la olmaydi (OneToOne)', async () => {
      const user = await createUser(ds, { role: 'STAFF' });
      await createStaff(ds, { user });
      await expect(createStaff(ds, { user })).rejects.toMatchObject(pgError(UNIQUE_VIOLATION));
    });
  });

  describe('Booking', () => {
    it('default status PENDING, notes null, relationlar yuklanadi', async () => {
      const b = await createBooking(ds);
      const found = await ds.getRepository('Booking').findOneOrFail({
        where: { id: b.id },
        relations: { customer: true, staff: { user: true }, service: true },
      });

      expect(found.status).toBe('PENDING');
      expect(found.notes ?? null).toBeNull();
      expect(found.customer.id).toBe(b.customer.id);
      expect(found.staff.user.id).toBe(b.staff.user.id);
      expect(found.service.id).toBe(b.service.id);
      expect(found.startTime).toBeInstanceOf(Date);
      expect(found.endTime).toBeInstanceOf(Date);
    });

    it('status qiymatlari: PENDING, CONFIRMED, CANCELLED, COMPLETED', async () => {
      for (const status of ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']) {
        await expect(createBooking(ds, { status })).resolves.toMatchObject({ status });
      }
    });

    it('mavjud bo`lmagan staff ga bog`lash FK xatosi beradi', async () => {
      await expect(createBooking(ds, { staff: { id: randomUUID() } })).rejects.toMatchObject(
        pgError(FK_VIOLATION),
      );
    });

    it('endTime <= startTime bo`lsa CHECK constraint rad etadi', async () => {
      const t = new Date('2030-01-01T10:00:00.000Z');
      await expect(createBooking(ds, { startTime: t, endTime: t })).rejects.toMatchObject(
        pgError(CHECK_VIOLATION),
      );
      await expect(
        createBooking(ds, { startTime: t, endTime: new Date('2030-01-01T09:00:00.000Z') }),
      ).rejects.toMatchObject(pgError(CHECK_VIOLATION));
    });

    it('vaqt zonasi saqlanadi: UTC instant aynan qaytadi', async () => {
      const start = new Date('2030-06-15T23:30:00.000Z');
      const end = new Date('2030-06-16T00:15:00.000Z');
      const b = await createBooking(ds, { startTime: start, endTime: end });
      const found = await ds.getRepository('Booking').findOneByOrFail({ id: b.id });

      expect(found.startTime.toISOString()).toBe(start.toISOString());
      expect(found.endTime.toISOString()).toBe(end.toISOString());
    });
  });

  describe('Referential integrity: booking mavjud bo`lsa, bog`liq yozuvni o`chirib bo`lmaydi', () => {
    it.each([
      ['Service', (b: any) => b.service.id],
      ['Staff', (b: any) => b.staff.id],
      ['User', (b: any) => b.customer.id],
    ])('%s o`chirilmaydi (FK)', async (entity, pickId) => {
      const booking = await createBooking(ds);
      await expect(ds.getRepository(entity).delete(pickId(booking))).rejects.toMatchObject(
        pgError(FK_VIOLATION),
      );
    });
  });
});
