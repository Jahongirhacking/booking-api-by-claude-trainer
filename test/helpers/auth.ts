import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createStaff } from '../m2/helpers/db';

const API = '/api/v1';
let counter = 0;

export type TestUser = { id: string; email: string; password: string; token: string };
export type TestStaff = TestUser & { staffId: string };
export type Role = 'ADMIN' | 'STAFF' | 'CUSTOMER';

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/**
 * Haqiqiy API orqali ro'yxatdan o'tkazadi, kerak bo'lsa DB da rolni o'zgartiradi
 * va login qilib token oladi. (Rol DB da o'zgargani uchun token'ni rol o'zgargandan KEYIN olamiz.)
 */
export async function createAuthedUser(
  app: INestApplication,
  o: { role?: Role; email?: string; fullName?: string; password?: string } = {},
): Promise<TestUser> {
  const server = app.getHttpServer();
  const email = o.email ?? `user${++counter}-${Date.now()}@test.com`;
  const password = o.password ?? 'Passw0rd!123';

  const reg = await request(server)
    .post(`${API}/auth/register`)
    .send({ email, fullName: o.fullName ?? 'Test User', password })
    .expect(201);

  if (o.role && o.role !== 'CUSTOMER') {
    await app.get(DataSource).getRepository('User').update(reg.body.id, { role: o.role });
  }

  const login = await request(server).post(`${API}/auth/login`).send({ email, password }).expect(200);
  return { id: reg.body.id, email, password, token: login.body.accessToken };
}

/** STAFF rolidagi user + unga bog'langan Staff profili (to'g'ridan-to'g'ri DB orqali). */
export async function createStaffUser(
  app: INestApplication,
  o: { specialization?: string; isActive?: boolean } = {},
): Promise<TestStaff> {
  const user = await createAuthedUser(app, { role: 'STAFF' });
  const staff = await createStaff(app.get(DataSource), { user: { id: user.id }, ...o });
  return { ...user, staffId: staff.id };
}
