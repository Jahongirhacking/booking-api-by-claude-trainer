import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bearer, createAuthedUser } from '../helpers/auth';
import { API, createTestApp } from '../m2/helpers/create-app';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('M5 | Request processing: middleware, interceptor, filter (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Request-ID middleware', () => {
    it('har bir javobda x-request-id (uuid) bor', async () => {
      const res = await http().get(`${API}/health`).expect(200);
      expect(res.headers['x-request-id']).toMatch(UUID);
    });

    it('har bir so`rov uchun yangi id', async () => {
      const a = await http().get(`${API}/health`);
      const b = await http().get(`${API}/health`);
      expect(a.headers['x-request-id']).not.toBe(b.headers['x-request-id']);
    });

    it('mijoz yuborgan to`g`ri uuid qaytariladi (tracing)', async () => {
      const id = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
      const res = await http().get(`${API}/health`).set('x-request-id', id).expect(200);
      expect(res.headers['x-request-id']).toBe(id);
    });

    it('mijoz yuborgan yaroqsiz qiymat qaytarilmaydi (header injection/log poisoning), o`rniga yangi uuid', async () => {
      const res = await http().get(`${API}/health`).set('x-request-id', 'not-a-uuid <script>').expect(200);
      expect(res.headers['x-request-id']).toMatch(UUID);
    });

    it('404 (route topilmagan) javobida ham bor', async () => {
      const res = await http().get(`${API}/nope`).expect(404);
      expect(res.headers['x-request-id']).toMatch(UUID);
    });
  });

  describe('Xato javoblarida requestId', () => {
    const expectRequestId = (res: request.Response) => {
      expect(res.body.requestId).toBe(res.headers['x-request-id']);
      expect(res.body.requestId).toMatch(UUID);
    };

    it('404', async () => expectRequestId(await http().get(`${API}/nope`).expect(404)));

    it('400 (validatsiya)', async () =>
      expectRequestId(await http().post(`${API}/auth/login`).send({}).expect(400)));

    it('401 (guard)', async () => expectRequestId(await http().get(`${API}/auth/me`).expect(401)));

    it('403 (RolesGuard)', async () => {
      const user = await createAuthedUser(app);
      expectRequestId(await http().post(`${API}/services`).set(bearer(user.token)).send({}).expect(403));
    });
  });

  describe('Response-time interceptor', () => {
    it('muvaffaqiyatli javobda x-response-time: "<son>ms"', async () => {
      const res = await http().get(`${API}/health`).expect(200);
      expect(res.headers['x-response-time']).toMatch(/^\d+(\.\d+)?ms$/);
    });

    it('autentifikatsiyalangan route`da ham ishlaydi', async () => {
      const user = await createAuthedUser(app);
      const res = await http().get(`${API}/auth/me`).set(bearer(user.token)).expect(200);
      expect(res.headers['x-response-time']).toMatch(/^\d+(\.\d+)?ms$/);
    });
  });
});
