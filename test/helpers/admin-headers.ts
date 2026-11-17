import { INestApplication } from '@nestjs/common';
import request from 'supertest';

/**
 * M1-M2 da auth yo'q, M3+ da (M5 dan) /services mutatsiyalari ADMIN talab qiladi.
 * Eski testlar (M1/M2 services e2e) har bir bosqichda ishlashi uchun:
 *  - auth route yo'q bo'lsa (404) -> bo'sh header qaytaradi,
 *  - bor bo'lsa -> ADMIN yaratib, Authorization header qaytaradi.
 */
export async function adminHeaders(app: INestApplication): Promise<Record<string, string>> {
  const server = app.getHttpServer();
  const email = `admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`;
  const password = 'Passw0rd!123';

  const reg = await request(server)
    .post('/api/v1/auth/register')
    .send({ email, fullName: 'Admin', password });
  if (reg.status === 404) return {};
  if (reg.status !== 201) throw new Error(`adminHeaders: register failed with ${reg.status}`);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DataSource } = require('typeorm');
  await app.get(DataSource).getRepository('User').update(reg.body.id, { role: 'ADMIN' });

  const login = await request(server).post('/api/v1/auth/login').send({ email, password });
  return { Authorization: `Bearer ${login.body.accessToken}` };
}
