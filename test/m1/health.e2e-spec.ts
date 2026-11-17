import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { API, createTestApp } from './helpers/create-app';

describe('M1 | Health & umumiy sozlamalar (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /health -> 200 va { status: "ok", timestamp }', async () => {
    const res = await request(app.getHttpServer()).get(`${API}/health`).expect(200);

    expect(res.body.status).toBe('ok');
    expect(typeof res.body.timestamp).toBe('string');
    expect(Number.isNaN(Date.parse(res.body.timestamp))).toBe(false);
  });

  it('global prefix: /health (prefikssiz) -> 404', async () => {
    await request(app.getHttpServer()).get('/health').expect(404);
  });

  it('mavjud bo`lmagan route -> 404 va yagona xato formati', async () => {
    const res = await request(app.getHttpServer()).get(`${API}/unknown-route`).expect(404);

    expect(res.body.statusCode).toBe(404);
    expect(res.body.message).toBeDefined();
    expect(res.body.path).toBe(`${API}/unknown-route`);
    expect(Number.isNaN(Date.parse(res.body.timestamp))).toBe(false);
  });
});
