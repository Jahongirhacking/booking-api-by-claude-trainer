import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { bearer, createAuthedUser, createStaffUser, TestStaff, TestUser } from '../helpers/auth';
import { at } from '../helpers/time';
import { API, createTestApp } from '../m2/helpers/create-app';
import { createService } from '../m2/helpers/db';
import { cleanUploads } from '../m6/helpers/files';

const UNKNOWN_UUID = '3f2b8c1e-5a4d-4e7b-9c1a-0d2e6f8a1b3c';
type RoleKey = 'anonim' | 'customer' | 'staff' | 'admin';
const ROLES: RoleKey[] = ['anonim', 'customer', 'staff', 'admin'];

describe('M7 | Xavfsizlik va yakuniy tekshiruvlar (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let admin: TestUser;
  let customer: TestUser;
  let customer2: TestUser;
  let staff: TestStaff;
  let service: { id: string };
  let counter = 0;

  const http = () => request(app.getHttpServer());
  const tokenOf = (r: RoleKey) => ({ anonim: null, customer, staff, admin })[r]?.token;
  const as = (r: RoleKey): Record<string, string> => (tokenOf(r) ? bearer(tokenOf(r)!) : {});

  beforeAll(async () => {
    await cleanUploads();
    app = await createTestApp();
    ds = app.get(DataSource);
    admin = await createAuthedUser(app, { role: 'ADMIN' });
    customer = await createAuthedUser(app);
    customer2 = await createAuthedUser(app);
    staff = await createStaffUser(app);
    service = await createService(ds, { name: 'Seeded', durationMinutes: 30 });
  });

  afterAll(async () => {
    await app.close();
    await cleanUploads();
  });

  /**
   * Rol matritsasi: [nom, method, url, body, kutilgan status har rol uchun]
   * 'admin' ustunlari: muvaffaqiyat yoki (ma'lumot yetishmasligi tufayli) 400/404 — lekin HECH QACHON 401/403 emas.
   */
  type Row = [string, 'get' | 'post' | 'patch', () => string, () => unknown, Record<RoleKey, number>];
  const matrix: Row[] = [
    ['GET /auth/me', 'get', () => `${API}/auth/me`, () => undefined, { anonim: 401, customer: 200, staff: 200, admin: 200 }],
    ['GET /services', 'get', () => `${API}/services`, () => undefined, { anonim: 200, customer: 200, staff: 200, admin: 200 }],
    [
      'POST /services',
      'post',
      () => `${API}/services`,
      () => ({ name: `Matrix ${++counter}`, durationMinutes: 30, price: 10 }),
      { anonim: 401, customer: 403, staff: 403, admin: 201 },
    ],
    ['GET /users', 'get', () => `${API}/users`, () => undefined, { anonim: 401, customer: 403, staff: 403, admin: 200 }],
    [
      'PATCH /users/:id/role',
      'patch',
      () => `${API}/users/${customer2.id}/role`,
      () => ({ role: 'NOPE' }),
      { anonim: 401, customer: 403, staff: 403, admin: 400 },
    ],
    ['GET /staff', 'get', () => `${API}/staff`, () => undefined, { anonim: 401, customer: 200, staff: 200, admin: 200 }],
    [
      'POST /staff',
      'post',
      () => `${API}/staff`,
      () => ({ userId: UNKNOWN_UUID }),
      { anonim: 401, customer: 403, staff: 403, admin: 404 },
    ],
    ['GET /bookings', 'get', () => `${API}/bookings`, () => undefined, { anonim: 401, customer: 200, staff: 200, admin: 200 }],
    [
      'POST /bookings',
      'post',
      () => `${API}/bookings`,
      () => ({ serviceId: service.id, staffId: staff.staffId, startTime: at(1000 + ++counter * 60) }),
      { anonim: 401, customer: 201, staff: 403, admin: 400 },
    ],
    ['POST /users/me/avatar (fayl yo`q)', 'post', () => `${API}/users/me/avatar`, () => undefined, { anonim: 401, customer: 400, staff: 400, admin: 400 }],
  ];

  describe('Rol matritsasi', () => {
    for (const [name, method, url, body, expected] of matrix) {
      for (const role of ROLES) {
        it(`${name} | ${role} -> ${expected[role]}`, async () => {
          const req = http()[method](url()).set(as(role));
          const res = await (body() === undefined ? req : req.send(body() as object));
          expect(res.status).toBe(expected[role]);
        });
      }
    }
  });

  describe('Maxfiy ma`lumot sizib chiqmasligi', () => {
    it('hech bir javobda passwordHash yoki bcrypt hash bo`lmaydi', async () => {
      const bodies: unknown[] = [];
      const reg = await http()
        .post(`${API}/auth/register`)
        .send({ email: 'leak@test.com', fullName: 'Leak Test', password: 'Passw0rd!123' })
        .expect(201);
      bodies.push(reg.body);
      bodies.push((await http().post(`${API}/auth/login`).send({ email: 'leak@test.com', password: 'Passw0rd!123' }).expect(200)).body);
      for (const [url, role] of [
        [`${API}/auth/me`, 'customer'],
        [`${API}/users`, 'admin'],
        [`${API}/staff`, 'customer'],
        [`${API}/bookings`, 'admin'],
        [`${API}/services`, 'anonim'],
      ] as Array<[string, RoleKey]>) {
        bodies.push((await http().get(url).set(as(role)).expect(200)).body);
      }

      const dump = JSON.stringify(bodies);
      expect(dump).not.toMatch(/passwordHash/i);
      expect(dump).not.toMatch(/\$2[aby]\$/);
      expect(dump).not.toContain('Passw0rd!123');
    });
  });

  describe('Yagona xato formati', () => {
    it.each<[number, () => request.Test]>([
      [400, () => http().post(`${API}/auth/login`).send({})],
      [401, () => http().get(`${API}/auth/me`)],
      [403, () => http().post(`${API}/services`).set(as('customer')).send({})],
      [404, () => http().get(`${API}/services/${UNKNOWN_UUID}`)],
    ])('%i: { statusCode, message, path, timestamp, requestId }', async (status, call) => {
      const res = await call().expect(status);
      expect(res.body).toEqual(
        expect.objectContaining({
          statusCode: status,
          message: expect.anything(),
          path: expect.stringContaining(API),
          timestamp: expect.any(String),
          requestId: expect.any(String),
        }),
      );
      expect(Number.isNaN(Date.parse(res.body.timestamp))).toBe(false);
    });

    it('409: { statusCode, message, path, timestamp, requestId }', async () => {
      const dup = { name: 'DupName', durationMinutes: 30, price: 1 };
      await http().post(`${API}/services`).set(as('admin')).send(dup).expect(201);
      const res = await http().post(`${API}/services`).set(as('admin')).send(dup).expect(409);
      expect(res.body).toEqual(
        expect.objectContaining({ statusCode: 409, path: `${API}/services`, requestId: expect.any(String) }),
      );
    });

    it('xato javoblarida stack trace yoki ichki SQL tafsiloti yo`q', async () => {
      const dup = { name: 'DupSql', durationMinutes: 30, price: 1 };
      await http().post(`${API}/services`).set(as('admin')).send(dup).expect(201);
      const res = await http().post(`${API}/services`).set(as('admin')).send(dup).expect(409);
      expect(JSON.stringify(res.body)).not.toMatch(/stack|SELECT|INSERT|duplicate key|constraint|QueryFailedError/i);
    });
  });

  describe('Zararli / g`alati kirishlar', () => {
    it('SQL injection urinishlari 400 (query/param validatsiyasi) beradi', async () => {
      await http().get(`${API}/bookings?status=${encodeURIComponent("CONFIRMED' OR '1'='1")}`).set(as('admin')).expect(400);
      await http().get(`${API}/services/${encodeURIComponent("1' OR '1'='1")}`).expect(400);
    });

    it('SQL parchasi ma`lumot sifatida AYNAN shundayligicha saqlanadi, jadval buzilmaydi', async () => {
      const name = "Robert'); DROP TABLE services;--";
      const created = await http()
        .post(`${API}/services`)
        .set(as('admin'))
        .send({ name, durationMinutes: 30, price: 1 })
        .expect(201);
      expect(created.body.name).toBe(name);

      const list = await http().get(`${API}/services`).expect(200);
      expect(list.body.map((s: { name: string }) => s.name)).toContain(name);
    });

    it('login: juda katta body (200 KB) -> 413 (body limit)', async () => {
      await http()
        .post(`${API}/auth/login`)
        .send({ email: 'a@test.com', password: 'a'.repeat(200_000) })
        .expect(413);
    });

    it('register: unicode ismlar saqlanadi', async () => {
      const res = await http()
        .post(`${API}/auth/register`)
        .send({ email: 'uz@test.com', fullName: "Oʻtkir Ŝaŭk 🙂", password: 'Passw0rd!123' })
        .expect(201);
      expect(res.body.fullName).toBe("Oʻtkir Ŝaŭk 🙂");
    });

    it('mass-assignment: PATCH /users/:id/role ga qo`shimcha maydon -> 400', async () => {
      await http()
        .patch(`${API}/users/${customer2.id}/role`)
        .set(as('admin'))
        .send({ role: 'STAFF', email: 'hacker@test.com' })
        .expect(400);
    });
  });

  describe('Bir vaqtdagi (concurrent) bronlar', () => {
    it('6 ta parallel so`rov bir xil slotga: aynan bittasi 201, qolganlari 409, hech qachon 5xx', async () => {
      const users = [customer, customer2, customer, customer2, customer, customer2];
      const results = await Promise.all(
        users.map((u) =>
          http()
            .post(`${API}/bookings`)
            .set(bearer(u.token))
            .send({ serviceId: service.id, staffId: staff.staffId, startTime: at(9000) }),
        ),
      );
      const statuses = results.map((r) => r.status);

      expect(statuses.filter((s) => s === 201)).toHaveLength(1);
      expect(statuses.filter((s) => s === 409)).toHaveLength(5);
      expect(statuses.some((s) => s >= 500)).toBe(false);
    });
  });
});
