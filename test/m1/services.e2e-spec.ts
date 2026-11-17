import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { adminHeaders } from '../helpers/admin-headers';
import { API, createTestApp } from './helpers/create-app';

describe('M1 | Services CRUD (e2e)', () => {
  let app: INestApplication;
  const url = `${API}/services`;
  const validPayload = {
    name: 'Haircut',
    description: 'Classic haircut',
    durationMinutes: 30,
    price: 50000,
  };
  const randomUuid = '3f2b8c1e-5a4d-4e7b-9c1a-0d2e6f8a1b3c';

  // M5 dan boshlab mutatsiyalar ADMIN talab qiladi; oldingi bosqichlarda header bo'sh bo'ladi.
  let authHeaders: Record<string, string> = {};
  const http = () => request.agent(app.getHttpServer()).set(authHeaders);
  const createService = (overrides: Record<string, unknown> = {}) =>
    http().post(url).send({ ...validPayload, ...overrides });

  beforeEach(async () => {
    app = await createTestApp();
    authHeaders = await adminHeaders(app);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /services', () => {
    it('to`g`ri ma`lumot bilan 201 qaytaradi', async () => {
      const res = await createService().expect(201);

      expect(res.body).toMatchObject({
        name: 'Haircut',
        description: 'Classic haircut',
        durationMinutes: 30,
        price: 50000,
      });
      expect(typeof res.body.id).toBe('string');
      expect(res.body.createdAt).toBeDefined();
    });

    it('description ixtiyoriy', async () => {
      const { description, ...withoutDescription } = validPayload;
      await http().post(url).send(withoutDescription).expect(201);
    });

    it('name atrofidagi bo`sh joylar kesiladi (trim)', async () => {
      const res = await createService({ name: '  Massage  ' }).expect(201);
      expect(res.body.name).toBe('Massage');
    });

    it.each([
      ['name yo`q', { name: undefined }],
      ['name bo`sh', { name: '' }],
      ['name faqat probel', { name: '   ' }],
      ['name 100 belgidan uzun', { name: 'a'.repeat(101) }],
      ['name son', { name: 123 }],
      ['durationMinutes yo`q', { durationMinutes: undefined }],
      ['durationMinutes matn', { durationMinutes: 'abc' }],
      ['durationMinutes 0', { durationMinutes: 0 }],
      ['durationMinutes 4 (min 5)', { durationMinutes: 4 }],
      ['durationMinutes 481 (max 480)', { durationMinutes: 481 }],
      ['durationMinutes kasr', { durationMinutes: 7.5 }],
      ['price yo`q', { price: undefined }],
      ['price manfiy', { price: -1 }],
      ['price matn', { price: 'free' }],
    ])('validatsiya: %s -> 400', async (_label, overrides) => {
      const res = await createService(overrides).expect(400);
      expect(res.body.statusCode).toBe(400);
      expect(res.body.message).toBeDefined();
    });

    it('price = 0 ruxsat etiladi', async () => {
      await createService({ price: 0 }).expect(201);
    });

    it('noma`lum maydon yuborilsa 400 (forbidNonWhitelisted)', async () => {
      await createService({ isAdmin: true }).expect(400);
    });

    it('nom takrorlansa 409 (katta-kichik harf farqsiz)', async () => {
      await createService().expect(201);
      const res = await createService({ name: 'HAIRCUT' }).expect(409);
      expect(res.body.statusCode).toBe(409);
    });
  });

  describe('GET /services', () => {
    it('boshida bo`sh massiv', async () => {
      const res = await http().get(url).expect(200);
      expect(res.body).toEqual([]);
    });

    it('yaratilgan xizmatlar ro`yxatini qaytaradi', async () => {
      await createService({ name: 'A' }).expect(201);
      await createService({ name: 'B' }).expect(201);

      const res = await http().get(url).expect(200);
      expect(res.body).toHaveLength(2);
    });
  });

  describe('GET /services/:id', () => {
    it('mavjud xizmatni qaytaradi', async () => {
      const created = await createService().expect(201);
      const res = await http().get(`${url}/${created.body.id}`).expect(200);
      expect(res.body.id).toBe(created.body.id);
      expect(res.body.name).toBe('Haircut');
    });

    it('mavjud bo`lmagan uuid -> 404', async () => {
      const res = await http().get(`${url}/${randomUuid}`).expect(404);
      expect(res.body.statusCode).toBe(404);
    });

    it('uuid formati noto`g`ri -> 400 (404 emas)', async () => {
      await http().get(`${url}/not-a-uuid`).expect(400);
    });
  });

  describe('PATCH /services/:id', () => {
    it('faqat yuborilgan maydonlar o`zgaradi', async () => {
      const created = await createService().expect(201);
      const res = await http()
        .patch(`${url}/${created.body.id}`)
        .send({ price: 70000 })
        .expect(200);

      expect(res.body.price).toBe(70000);
      expect(res.body.name).toBe('Haircut');
      expect(res.body.durationMinutes).toBe(30);
    });

    it('bo`sh body -> 200, ma`lumot o`zgarmaydi', async () => {
      const created = await createService().expect(201);
      const res = await http().patch(`${url}/${created.body.id}`).send({}).expect(200);
      expect(res.body.name).toBe('Haircut');
    });

    it('noto`g`ri qiymat -> 400', async () => {
      const created = await createService().expect(201);
      await http().patch(`${url}/${created.body.id}`).send({ durationMinutes: 0 }).expect(400);
    });

    it('noma`lum maydon -> 400', async () => {
      const created = await createService().expect(201);
      await http().patch(`${url}/${created.body.id}`).send({ foo: 'bar' }).expect(400);
    });

    it('mavjud bo`lmagan id -> 404', async () => {
      await http().patch(`${url}/${randomUuid}`).send({ price: 1 }).expect(404);
    });

    it('uuid noto`g`ri -> 400', async () => {
      await http().patch(`${url}/abc`).send({ price: 1 }).expect(400);
    });

    it('boshqa xizmat nomini olsa -> 409', async () => {
      await createService({ name: 'A' }).expect(201);
      const b = await createService({ name: 'B' }).expect(201);
      await http().patch(`${url}/${b.body.id}`).send({ name: 'a' }).expect(409);
    });

    it('o`z nomini qayta yuborsa -> 200', async () => {
      const created = await createService().expect(201);
      await http().patch(`${url}/${created.body.id}`).send({ name: 'Haircut' }).expect(200);
    });
  });

  describe('DELETE /services/:id', () => {
    it('204 qaytaradi, body bo`sh, keyin GET -> 404', async () => {
      const created = await createService().expect(201);
      const res = await http().delete(`${url}/${created.body.id}`).expect(204);
      expect(res.body).toEqual({});
      await http().get(`${url}/${created.body.id}`).expect(404);
    });

    it('mavjud bo`lmagan id -> 404', async () => {
      await http().delete(`${url}/${randomUuid}`).expect(404);
    });

    it('uuid noto`g`ri -> 400', async () => {
      await http().delete(`${url}/xyz`).expect(400);
    });
  });

  describe('Yagona xato formati (Exception Filter)', () => {
    it('har bir xato { statusCode, message, path, timestamp } ni o`z ichiga oladi', async () => {
      const res = await http().get(`${url}/${randomUuid}`).expect(404);

      expect(res.body.statusCode).toBe(404);
      expect(res.body.message).toBeDefined();
      expect(res.body.path).toBe(`${url}/${randomUuid}`);
      expect(Number.isNaN(Date.parse(res.body.timestamp))).toBe(false);
    });

    it('validatsiya xatosi ham shu formatda', async () => {
      const res = await createService({ price: -5 }).expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(res.body.path).toBe(url);
      expect(res.body.timestamp).toBeDefined();
    });
  });
});
