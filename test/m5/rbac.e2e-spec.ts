import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { bearer, createAuthedUser, createStaffUser, TestStaff, TestUser } from '../helpers/auth';
import { at } from '../helpers/time';
import { API, createTestApp } from '../m2/helpers/create-app';
import { createBooking, createService } from '../m2/helpers/db';

const UNKNOWN_UUID = '3f2b8c1e-5a4d-4e7b-9c1a-0d2e6f8a1b3c';

describe('M5 | RBAC (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let admin: TestUser;
  let staff: TestStaff;
  let customer: TestUser;

  const http = () => request(app.getHttpServer());
  const as = (role: string): Record<string, string> =>
    role === 'anonim' ? {} : bearer({ admin, staff, customer }[role as 'admin'].token);

  beforeEach(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);
    admin = await createAuthedUser(app, { role: 'ADMIN' });
    staff = await createStaffUser(app);
    customer = await createAuthedUser(app);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Services: yozish faqat ADMIN', () => {
    let n = 0;
    const payload = () => ({ name: `Svc ${++n}`, durationMinutes: 30, price: 100 });

    it.each(['anonim', 'customer', 'staff', 'admin'])('GET /services ochiq (%s) -> 200', async (role) => {
      await http().get(`${API}/services`).set(as(role)).expect(200);
    });

    it.each([
      ['anonim', 401],
      ['customer', 403],
      ['staff', 403],
      ['admin', 201],
    ])('POST /services (%s) -> %i', async (role, status) => {
      await http().post(`${API}/services`).set(as(role)).send(payload()).expect(status);
    });

    it.each([
      ['anonim', 401],
      ['customer', 403],
      ['staff', 403],
      ['admin', 200],
    ])('PATCH /services/:id (%s) -> %i', async (role, status) => {
      const s = await createService(ds);
      await http().patch(`${API}/services/${s.id}`).set(as(role)).send({ price: 5 }).expect(status);
    });

    it.each([
      ['anonim', 401],
      ['customer', 403],
      ['staff', 403],
      ['admin', 204],
    ])('DELETE /services/:id (%s) -> %i', async (role, status) => {
      const s = await createService(ds);
      await http().delete(`${API}/services/${s.id}`).set(as(role)).expect(status);
    });

    it('guard validatsiya/404 dan OLDIN ishlaydi: customer mavjud bo`lmagan id ga PATCH -> 403 (404 emas)', async () => {
      await http().patch(`${API}/services/${UNKNOWN_UUID}`).set(as('customer')).send({ price: 1 }).expect(403);
    });

    it('guard validatsiyadan oldin: customer noto`g`ri body bilan POST -> 403 (400 emas)', async () => {
      await http().post(`${API}/services`).set(as('customer')).send({}).expect(403);
    });

    it('admin: validatsiya va takroriy nom hamon ishlaydi', async () => {
      await http().post(`${API}/services`).set(as('admin')).send({ name: '' }).expect(400);
      await http().post(`${API}/services`).set(as('admin')).send(payload()).expect(201);
      await http().post(`${API}/services`).set(as('admin')).send({ name: 'Svc 1', durationMinutes: 30, price: 1 }).expect(409);
    });
  });

  describe('Users (faqat ADMIN)', () => {
    it.each([
      ['anonim', 401],
      ['customer', 403],
      ['staff', 403],
      ['admin', 200],
    ])('GET /users (%s) -> %i', async (role, status) => {
      await http().get(`${API}/users`).set(as(role)).expect(status);
    });

    it('GET /users: parol/hash qaytmaydi, kerakli maydonlar bor', async () => {
      const res = await http().get(`${API}/users`).set(as('admin')).expect(200);
      expect(res.body).toHaveLength(3);
      expect(res.body[0]).toEqual(
        expect.objectContaining({ id: expect.any(String), email: expect.any(String), role: expect.any(String) }),
      );
      expect(JSON.stringify(res.body)).not.toMatch(/password/i);
    });

    it('PATCH /users/:id/role: admin rolni o`zgartiradi', async () => {
      const res = await http()
        .patch(`${API}/users/${customer.id}/role`)
        .set(as('admin'))
        .send({ role: 'ADMIN' })
        .expect(200);
      expect(res.body.role).toBe('ADMIN');
    });

    it('rol o`zgargach, ESKI token yangi huquqlarni darhol oladi (rol har so`rovda DB dan o`qiladi)', async () => {
      await http().get(`${API}/users`).set(as('customer')).expect(403);
      await http().patch(`${API}/users/${customer.id}/role`).set(as('admin')).send({ role: 'ADMIN' }).expect(200);
      await http().get(`${API}/users`).set(as('customer')).expect(200);
    });

    it.each([
      ['anonim', 401],
      ['customer', 403],
      ['staff', 403],
    ])('PATCH /users/:id/role (%s) -> %i', async (role, status) => {
      await http().patch(`${API}/users/${customer.id}/role`).set(as(role)).send({ role: 'ADMIN' }).expect(status);
    });

    it('noto`g`ri rol -> 400; mavjud bo`lmagan user -> 404; uuid noto`g`ri -> 400', async () => {
      await http().patch(`${API}/users/${customer.id}/role`).set(as('admin')).send({ role: 'ROOT' }).expect(400);
      await http().patch(`${API}/users/${UNKNOWN_UUID}/role`).set(as('admin')).send({ role: 'STAFF' }).expect(404);
      await http().patch(`${API}/users/abc/role`).set(as('admin')).send({ role: 'STAFF' }).expect(400);
    });

    it('admin o`z rolini pasaytira olmaydi (oxirgi admin qulflanib qolmasligi uchun) -> 409', async () => {
      await http().patch(`${API}/users/${admin.id}/role`).set(as('admin')).send({ role: 'CUSTOMER' }).expect(409);
    });
  });

  describe('Staff boshqaruvi', () => {
    it.each([
      ['anonim', 401],
      ['customer', 403],
      ['staff', 403],
    ])('POST /staff (%s) -> %i', async (role, status) => {
      await http().post(`${API}/staff`).set(as(role)).send({ userId: customer.id }).expect(status);
    });

    it('admin: user ni staff qiladi -> 201, user.role = STAFF (eski token bilan ham ko`rinadi)', async () => {
      const res = await http()
        .post(`${API}/staff`)
        .set(as('admin'))
        .send({ userId: customer.id, specialization: 'Barber' })
        .expect(201);

      expect(res.body).toMatchObject({ userId: customer.id, specialization: 'Barber', isActive: true });
      expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);

      const profile = await http().get(`${API}/auth/me`).set(as('customer')).expect(200);
      expect(profile.body.role).toBe('STAFF');
    });

    it('mavjud bo`lmagan user -> 404; uuid noto`g`ri -> 400; allaqachon staff -> 409', async () => {
      await http().post(`${API}/staff`).set(as('admin')).send({ userId: UNKNOWN_UUID }).expect(404);
      await http().post(`${API}/staff`).set(as('admin')).send({ userId: 'abc' }).expect(400);
      await http().post(`${API}/staff`).set(as('admin')).send({ userId: staff.id }).expect(409);
    });

    it('GET /staff: istalgan autentifikatsiyalangan foydalanuvchi, faqat ochiq maydonlar', async () => {
      await http().get(`${API}/staff`).expect(401);
      const res = await http().get(`${API}/staff`).set(as('customer')).expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({ id: staff.staffId, userId: staff.id, isActive: true });
      expect(res.body[0].fullName).toEqual(expect.any(String));
      expect(JSON.stringify(res.body)).not.toMatch(/password|email/i);
    });

    it('PATCH /staff/:id: admin o`zgartiradi, boshqalar 403', async () => {
      await http().patch(`${API}/staff/${staff.staffId}`).set(as('customer')).send({ isActive: false }).expect(403);
      await http().patch(`${API}/staff/${staff.staffId}`).set(as('staff')).send({ isActive: false }).expect(403);
      const res = await http()
        .patch(`${API}/staff/${staff.staffId}`)
        .set(as('admin'))
        .send({ isActive: false, specialization: 'Colorist' })
        .expect(200);
      expect(res.body).toMatchObject({ isActive: false, specialization: 'Colorist' });
    });

    it('nofaol qilingan staff ga yangi bron -> 400', async () => {
      const service = await createService(ds);
      await http().patch(`${API}/staff/${staff.staffId}`).set(as('admin')).send({ isActive: false }).expect(200);
      await http()
        .post(`${API}/bookings`)
        .set(as('customer'))
        .send({ serviceId: service.id, staffId: staff.staffId, startTime: at(0) })
        .expect(400);
    });
  });

  describe('Bookings: rol qoidalari', () => {
    let service: { id: string };
    const create = (role: string, o: Record<string, unknown> = {}) =>
      http()
        .post(`${API}/bookings`)
        .set(as(role))
        .send({ serviceId: service.id, staffId: staff.staffId, startTime: at(0), ...o });

    beforeEach(async () => {
      service = await createService(ds);
    });

    it('admin customerId bilan boshqa mijoz nomidan bron yaratadi -> 201', async () => {
      const res = await create('admin', { customerId: customer.id }).expect(201);
      expect(res.body.customerId).toBe(customer.id);
    });

    it('admin customerId siz -> 400; mavjud bo`lmagan customerId -> 404', async () => {
      await create('admin').expect(400);
      await create('admin', { customerId: UNKNOWN_UUID }).expect(404);
    });

    it('customer customerId yubora olmaydi -> 403', async () => {
      await create('customer', { customerId: admin.id }).expect(403);
      await create('customer', { customerId: customer.id }).expect(403);
    });

    it('staff bron yarata olmaydi -> 403', async () => {
      await create('staff').expect(403);
    });

    describe('?from & ?to (custom pipe)', () => {
      const list = (qs: string) => http().get(`${API}/bookings${qs}`).set(as('admin'));

      beforeEach(async () => {
        for (const m of [0, 60, 120]) {
          await createBooking(ds, {
            customer: { id: customer.id },
            staff: { id: staff.staffId },
            service: { id: service.id },
            startTime: new Date(at(m)),
            endTime: new Date(at(m + 30)),
          });
        }
      });

      it('[from, to) oralig`ida boshlanganlar qaytadi', async () => {
        const res = await list(`?from=${encodeURIComponent(at(50))}&to=${encodeURIComponent(at(130))}`).expect(200);
        expect(res.body.map((b: { startTime: string }) => b.startTime)).toEqual([at(60), at(120)]);
      });

      it('to chegarasi kiritilmaydi (yarim ochiq): to = at(120) -> at(120) qaytmaydi', async () => {
        const res = await list(`?to=${encodeURIComponent(at(120))}`).expect(200);
        expect(res.body).toHaveLength(2);
      });

      it('faqat from berilsa ishlaydi', async () => {
        const res = await list(`?from=${encodeURIComponent(at(60))}`).expect(200);
        expect(res.body).toHaveLength(2);
      });

      it.each([
        ['from ISO emas', '?from=yesterday'],
        ['to ISO emas', '?to=123abc'],
      ])('%s -> 400', async (_l, qs) => {
        await list(qs).expect(400);
      });

      it('from > to -> 400', async () => {
        await list(`?from=${encodeURIComponent(at(100))}&to=${encodeURIComponent(at(10))}`).expect(400);
      });
    });
  });
});
