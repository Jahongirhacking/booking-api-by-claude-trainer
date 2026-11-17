import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { API, createTestApp } from './helpers/create-app';

describe('M2 | Health + DB (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /health: status "ok" va database "up"', async () => {
    const res = await request(app.getHttpServer()).get(`${API}/health`).expect(200);

    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('up');
    expect(Number.isNaN(Date.parse(res.body.timestamp))).toBe(false);
  });
});
