import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { bearer, createAuthedUser, TestUser } from '../helpers/auth';
import { ago, at } from '../helpers/time';
import { API, createTestApp } from '../m2/helpers/create-app';
import { createBooking } from '../m2/helpers/db';
import { cleanUploads, listUploaded, png } from '../m6/helpers/files';

/**
 * Yakuniy integratsiya: butun tizim bitta real senariyda — registratsiyadan bronni yakunlashgacha.
 * Bu test faqat OCHIQ API orqali ishlaydi (faqat admin roli va "o'tmishdagi bron" DB orqali tayyorlanadi).
 */
describe('M7 | Foydalanuvchi sayohati (e2e journey)', () => {
  let app: INestApplication;
  let ds: DataSource;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    await cleanUploads();
    app = await createTestApp();
    ds = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
    await cleanUploads();
  });

  // Bosqichlar bir-biriga bog'liq (ketma-ket), shuning uchun holat shu yerda saqlanadi.
  let admin: TestUser;
  let customer: TestUser;
  let barber: TestUser;
  let serviceId: string;
  let staffId: string;
  let bookingId: string;
  let secondBookingId: string;

  it('1) ADMIN xizmat yaratadi', async () => {
    admin = await createAuthedUser(app, { role: 'ADMIN' });
    const res = await http()
      .post(`${API}/services`)
      .set(bearer(admin.token))
      .send({ name: 'Haircut', description: 'Classic', durationMinutes: 45, price: 59000.5 })
      .expect(201);
    serviceId = res.body.id;
    expect(res.body.price).toBe(59000.5);
  });

  it('2) Oddiy foydalanuvchi ro`yxatdan o`tadi va ADMIN uni STAFF qiladi', async () => {
    barber = await createAuthedUser(app, { fullName: 'Barber Bobur' });
    const res = await http()
      .post(`${API}/staff`)
      .set(bearer(admin.token))
      .send({ userId: barber.id, specialization: 'Barber' })
      .expect(201);
    staffId = res.body.id;

    const profile = await http().get(`${API}/auth/me`).set(bearer(barber.token)).expect(200);
    expect(profile.body.role).toBe('STAFF');
  });

  it('3) MIJOZ ro`yxatdan o`tadi, xizmatlar va staff ro`yxatini ko`radi', async () => {
    const reg = await http()
      .post(`${API}/auth/register`)
      .send({ email: 'Customer@Test.com', fullName: 'Mijoz', password: 'Passw0rd!123' })
      .expect(201);
    expect(reg.body.email).toBe('customer@test.com');

    const login = await http()
      .post(`${API}/auth/login`)
      .send({ email: 'customer@test.com', password: 'Passw0rd!123' })
      .expect(200);
    customer = { id: reg.body.id, email: 'customer@test.com', password: 'Passw0rd!123', token: login.body.accessToken };

    const services = await http().get(`${API}/services`).expect(200);
    expect(services.body.map((s: { id: string }) => s.id)).toContain(serviceId);

    const staff = await http().get(`${API}/staff`).set(bearer(customer.token)).expect(200);
    expect(staff.body.map((s: { id: string }) => s.id)).toContain(staffId);
  });

  it('4) MIJOZ bron qiladi: PENDING, endTime = +45 daqiqa', async () => {
    const res = await http()
      .post(`${API}/bookings`)
      .set(bearer(customer.token))
      .send({ serviceId, staffId, startTime: at(0), notes: 'First visit' })
      .expect(201);
    bookingId = res.body.id;

    expect(res.body).toMatchObject({ status: 'PENDING', endTime: at(45), customerId: customer.id });
  });

  it('5) Boshqa mijoz shu slotga bron qila olmaydi (409)', async () => {
    const other = await createAuthedUser(app);
    await http()
      .post(`${API}/bookings`)
      .set(bearer(other.token))
      .send({ serviceId, staffId, startTime: at(15) })
      .expect(409);
  });

  it('6) STAFF o`z bronlarini ko`radi va tasdiqlaydi', async () => {
    const list = await http().get(`${API}/bookings`).set(bearer(barber.token)).expect(200);
    expect(list.body.map((b: { id: string }) => b.id)).toEqual([bookingId]);

    const res = await http()
      .patch(`${API}/bookings/${bookingId}/status`)
      .set(bearer(barber.token))
      .send({ status: 'CONFIRMED' })
      .expect(200);
    expect(res.body.status).toBe('CONFIRMED');
  });

  it('7) MIJOZ tasdiqlangan bronni bekor qiladi, slot bo`shaydi va qayta bron qiladi', async () => {
    await http()
      .patch(`${API}/bookings/${bookingId}/status`)
      .set(bearer(customer.token))
      .send({ status: 'CANCELLED' })
      .expect(200);

    const again = await http()
      .post(`${API}/bookings`)
      .set(bearer(customer.token))
      .send({ serviceId, staffId, startTime: at(0) })
      .expect(201);
    secondBookingId = again.body.id;
  });

  it('8) Bekor qilingan bronni qayta tasdiqlab bo`lmaydi (409)', async () => {
    await http()
      .patch(`${API}/bookings/${bookingId}/status`)
      .set(bearer(admin.token))
      .send({ status: 'CONFIRMED' })
      .expect(409);
  });

  it('9) ADMIN barcha bronlarni va status bo`yicha filtrni ko`radi', async () => {
    const all = await http().get(`${API}/bookings`).set(bearer(admin.token)).expect(200);
    expect(all.body).toHaveLength(2);

    const cancelled = await http().get(`${API}/bookings?status=CANCELLED`).set(bearer(admin.token)).expect(200);
    expect(cancelled.body.map((b: { id: string }) => b.id)).toEqual([bookingId]);
  });

  it('10) Xizmat bron bilan bog`langan: ADMIN o`chira olmaydi (409)', async () => {
    await http().delete(`${API}/services/${serviceId}`).set(bearer(admin.token)).expect(409);
  });

  it('11) Tugagan bron STAFF tomonidan COMPLETED qilinadi (o`tmishdagi bron)', async () => {
    const past = await createBooking(ds, {
      customer: { id: customer.id },
      staff: { id: staffId },
      service: { id: serviceId },
      startTime: ago(180),
      endTime: ago(135),
      status: 'CONFIRMED',
    });
    const res = await http()
      .patch(`${API}/bookings/${past.id}/status`)
      .set(bearer(barber.token))
      .send({ status: 'COMPLETED' })
      .expect(200);
    expect(res.body.status).toBe('COMPLETED');
  });

  it('12) MIJOZ avatar yuklaydi, ADMIN xizmatga rasm qo`yadi', async () => {
    const a = await http()
      .post(`${API}/users/me/avatar`)
      .set(bearer(customer.token))
      .attach('file', png(), { filename: 'me.png', contentType: 'image/png' })
      .expect(201);
    const s = await http()
      .post(`${API}/services/${serviceId}/image`)
      .set(bearer(admin.token))
      .attach('file', png(), { filename: 's.png', contentType: 'image/png' })
      .expect(201);

    expect((await http().get(`${API}/auth/me`).set(bearer(customer.token))).body.avatarUrl).toBe(a.body.avatarUrl);
    expect((await http().get(`${API}/services/${serviceId}`)).body.imageUrl).toBe(s.body.imageUrl);
    expect(await listUploaded()).toHaveLength(2);
  });

  it('13) ADMIN staff ni nofaol qiladi: yangi bron 400, mavjud bronlar saqlanadi', async () => {
    await http().patch(`${API}/staff/${staffId}`).set(bearer(admin.token)).send({ isActive: false }).expect(200);
    await http()
      .post(`${API}/bookings`)
      .set(bearer(customer.token))
      .send({ serviceId, staffId, startTime: at(600) })
      .expect(400);

    const mine = await http().get(`${API}/bookings/${secondBookingId}`).set(bearer(customer.token)).expect(200);
    expect(mine.body.status).toBe('PENDING');
  });
});
