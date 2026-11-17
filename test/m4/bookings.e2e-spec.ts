import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { bearer, createAuthedUser, createStaffUser, TestStaff, TestUser } from '../helpers/auth';
import { ago, at } from '../helpers/time';
import { API, createTestApp } from '../m2/helpers/create-app';
import { createBooking, createService } from '../m2/helpers/db';

describe('M4 | Bookings biznes logikasi (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let customer: TestUser;
  let customer2: TestUser;
  let admin: TestUser;
  let staffA: TestStaff;
  let staffB: TestStaff;
  let service: { id: string };
  let longService: { id: string };

  const http = () => request(app.getHttpServer());

  const book = (u: TestUser, o: Record<string, unknown> = {}) =>
    http()
      .post(`${API}/bookings`)
      .set(bearer(u.token))
      .send({ serviceId: service.id, staffId: staffA.staffId, startTime: at(0), ...o });

  const setStatus = (u: TestUser, id: string, status: string) =>
    http().patch(`${API}/bookings/${id}/status`).set(bearer(u.token)).send({ status });

  /** DB ga to'g'ridan-to'g'ri yozadi (qoidalarni chetlab o'tadi): o'tmishdagi/maxsus holatlar uchun. */
  const seed = (o: Record<string, unknown> = {}) =>
    createBooking(ds, {
      customer: { id: customer.id },
      staff: { id: staffA.staffId },
      service: { id: service.id },
      startTime: new Date(at(0)),
      endTime: new Date(at(30)),
      ...o,
    });

  beforeAll(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);
    customer = await createAuthedUser(app);
    customer2 = await createAuthedUser(app);
    admin = await createAuthedUser(app, { role: 'ADMIN' });
    staffA = await createStaffUser(app);
    staffB = await createStaffUser(app);
    service = await createService(ds, { name: 'Haircut', durationMinutes: 30 });
    longService = await createService(ds, { name: 'Coloring', durationMinutes: 120 });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await ds.getRepository('Booking').createQueryBuilder().delete().execute();
    await ds.getRepository('Staff').update({ id: staffA.staffId }, { isActive: true });
  });

  describe('POST /bookings', () => {
    it('201: PENDING, endTime = start + service.durationMinutes, customerId = men', async () => {
      const res = await book(customer).expect(201);

      expect(res.body).toMatchObject({
        status: 'PENDING',
        startTime: at(0),
        endTime: at(30),
        customerId: customer.id,
        staffId: staffA.staffId,
        serviceId: service.id,
      });
      expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('davomiylik xizmatga qarab hisoblanadi (120 daqiqa)', async () => {
      const res = await book(customer, { serviceId: longService.id }).expect(201);
      expect(res.body.endTime).toBe(at(120));
    });

    it('notes saqlanadi', async () => {
      const res = await book(customer, { notes: 'Please be on time' }).expect(201);
      expect(res.body.notes).toBe('Please be on time');
    });

    it('javobda parol/hash yoki ichki relation (user obyekti) yo`q', async () => {
      const res = await book(customer).expect(201);
      expect(JSON.stringify(res.body)).not.toMatch(/password|email/i);
    });

    it('tokensiz -> 401', async () => {
      await http()
        .post(`${API}/bookings`)
        .send({ serviceId: service.id, staffId: staffA.staffId, startTime: at(0) })
        .expect(401);
    });

    it.each([
      ['startTime yo`q', { startTime: undefined }],
      ['startTime ISO emas', { startTime: 'tomorrow 10am' }],
      ['serviceId uuid emas', { serviceId: '123' }],
      ['staffId uuid emas', { staffId: 'abc' }],
      ['serviceId yo`q', { serviceId: undefined }],
      ['status yuborildi (mass assignment)', { status: 'CONFIRMED' }],
      ['endTime yuborildi', { endTime: at(60) }],
      ['notes 500 belgidan uzun', { notes: 'x'.repeat(501) }],
    ])('validatsiya: %s -> 400', async (_l, overrides) => {
      await book(customer, overrides).expect(400);
    });

    it('o`tmishdagi vaqt -> 400', async () => {
      await book(customer, { startTime: ago(60).toISOString() }).expect(400);
    });

    it('mavjud bo`lmagan service -> 404', async () => {
      await book(customer, { serviceId: '3f2b8c1e-5a4d-4e7b-9c1a-0d2e6f8a1b3c' }).expect(404);
    });

    it('mavjud bo`lmagan staff -> 404', async () => {
      await book(customer, { staffId: '3f2b8c1e-5a4d-4e7b-9c1a-0d2e6f8a1b3c' }).expect(404);
    });

    it('nofaol (isActive=false) staff -> 400', async () => {
      await ds.getRepository('Staff').update({ id: staffA.staffId }, { isActive: false });
      await book(customer).expect(400);
    });
  });

  describe('Staff band bo`lishi (overlap)', () => {
    beforeEach(async () => {
      await seed({ status: 'PENDING' }); // staffA: at(0)..at(30)
    });

    it.each([
      ['boshida kesishadi (-15)', -15],
      ['ichidan boshlanadi (+15)', 15],
      ['aynan bir xil (0)', 0],
      ['oxirgi daqiqada boshlanadi (+29)', 29],
    ])('kesishadi: %s -> 409', async (_l, offset) => {
      const res = await book(customer2, { startTime: at(offset) }).expect(409);
      expect(res.body.statusCode).toBe(409);
    });

    it('uzun xizmat mavjud bronni to`liq o`rab olsa -> 409', async () => {
      await book(customer2, { serviceId: longService.id, startTime: at(-30) }).expect(409);
    });

    it.each([
      ['yonma-yon keyin (+30)', 30],
      ['yonma-yon oldin (-30)', -30],
      ['ancha keyin (+120)', 120],
    ])('kesishmaydi: %s -> 201', async (_l, offset) => {
      await book(customer2, { startTime: at(offset) }).expect(201);
    });

    it('boshqa staff bilan shu vaqtga -> 201', async () => {
      await book(customer2, { staffId: staffB.staffId }).expect(201);
    });

    it('CONFIRMED bron ham band qiladi', async () => {
      await ds.getRepository('Booking').createQueryBuilder().delete().execute();
      await seed({ status: 'CONFIRMED' });
      await book(customer2).expect(409);
    });

    it('CANCELLED bron bandlik hisoblanmaydi', async () => {
      await ds.getRepository('Booking').createQueryBuilder().delete().execute();
      await seed({ status: 'CANCELLED' });
      await book(customer2).expect(201);
    });

    it('bir vaqtda ikki mijoz bir xil slotga: bittasi 201, boshqasi 409 (race condition)', async () => {
      await ds.getRepository('Booking').createQueryBuilder().delete().execute();
      const results = await Promise.all([book(customer, { startTime: at(300) }), book(customer2, { startTime: at(300) })]);

      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      const count = await ds
        .getRepository('Booking')
        .createQueryBuilder('b')
        .where('b.status IN (:...s)', { s: ['PENDING', 'CONFIRMED'] })
        .getCount();
      expect(count).toBe(1);
    });
  });

  describe('GET /bookings (ko`rinish doirasi)', () => {
    beforeEach(async () => {
      await seed({ startTime: new Date(at(0)), endTime: new Date(at(30)) });
      await seed({ customer: { id: customer2.id }, staff: { id: staffB.staffId }, startTime: new Date(at(60)), endTime: new Date(at(90)) });
      await seed({ startTime: new Date(at(120)), endTime: new Date(at(150)), status: 'CANCELLED' });
    });

    const list = (u: TestUser, qs = '') => http().get(`${API}/bookings${qs}`).set(bearer(u.token));

    it('customer faqat o`zinikini ko`radi', async () => {
      const res = await list(customer).expect(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.every((b: { customerId: string }) => b.customerId === customer.id)).toBe(true);
    });

    it('staff faqat o`ziga biriktirilganlarni ko`radi', async () => {
      const res = await list(staffB).expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].staffId).toBe(staffB.staffId);
    });

    it('admin hammasini ko`radi', async () => {
      const res = await list(admin).expect(200);
      expect(res.body).toHaveLength(3);
    });

    it('startTime o`sish tartibida', async () => {
      const res = await list(admin).expect(200);
      const times = res.body.map((b: { startTime: string }) => b.startTime);
      expect(times).toEqual([...times].sort());
    });

    it('?status= bo`yicha filtr', async () => {
      const res = await list(admin, '?status=CANCELLED').expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].status).toBe('CANCELLED');
    });

    it('noto`g`ri ?status -> 400', async () => {
      await list(admin, '?status=FOO').expect(400);
    });

    it('tokensiz -> 401', async () => {
      await http().get(`${API}/bookings`).expect(401);
    });
  });

  describe('GET /bookings/:id', () => {
    it('egasi, biriktirilgan staff va admin ko`ra oladi', async () => {
      const b = await seed();
      for (const u of [customer, staffA, admin]) {
        const res = await http().get(`${API}/bookings/${b.id}`).set(bearer(u.token)).expect(200);
        expect(res.body.id).toBe(b.id);
      }
    });

    it('boshqa mijoz va boshqa staff uchun 404 (mavjudligi sir saqlanadi)', async () => {
      const b = await seed();
      await http().get(`${API}/bookings/${b.id}`).set(bearer(customer2.token)).expect(404);
      await http().get(`${API}/bookings/${b.id}`).set(bearer(staffB.token)).expect(404);
    });

    it('uuid noto`g`ri -> 400, mavjud emas -> 404', async () => {
      await http().get(`${API}/bookings/xyz`).set(bearer(admin.token)).expect(400);
      await http()
        .get(`${API}/bookings/3f2b8c1e-5a4d-4e7b-9c1a-0d2e6f8a1b3c`)
        .set(bearer(admin.token))
        .expect(404);
    });
  });

  describe('PATCH /bookings/:id/status (holat o`tishlari)', () => {
    it('customer o`z PENDING bronini bekor qiladi -> 200', async () => {
      const b = await seed();
      const res = await setStatus(customer, b.id, 'CANCELLED').expect(200);
      expect(res.body.status).toBe('CANCELLED');
    });

    it('customer o`z CONFIRMED bronini ham bekor qila oladi', async () => {
      const b = await seed({ status: 'CONFIRMED' });
      await setStatus(customer, b.id, 'CANCELLED').expect(200);
    });

    it('customer tasdiqlay olmaydi -> 403', async () => {
      const b = await seed();
      await setStatus(customer, b.id, 'CONFIRMED').expect(403);
    });

    it('customer boshqaning broniga tegolmaydi -> 404', async () => {
      const b = await seed();
      await setStatus(customer2, b.id, 'CANCELLED').expect(404);
    });

    it('biriktirilgan staff tasdiqlaydi -> 200', async () => {
      const b = await seed();
      const res = await setStatus(staffA, b.id, 'CONFIRMED').expect(200);
      expect(res.body.status).toBe('CONFIRMED');
    });

    it('boshqa staff tegolmaydi -> 404', async () => {
      const b = await seed();
      await setStatus(staffB, b.id, 'CONFIRMED').expect(404);
    });

    it('admin har qanday to`g`ri o`tishni bajaradi', async () => {
      const b = await seed();
      await setStatus(admin, b.id, 'CONFIRMED').expect(200);
      await setStatus(admin, b.id, 'CANCELLED').expect(200);
    });

    it('o`tgan CONFIRMED bronni staff COMPLETED qiladi -> 200', async () => {
      const b = await seed({ status: 'CONFIRMED', startTime: ago(120), endTime: ago(90) });
      const res = await setStatus(staffA, b.id, 'COMPLETED').expect(200);
      expect(res.body.status).toBe('COMPLETED');
    });

    it('hali boshlanmagan bronni COMPLETED qilib bo`lmaydi -> 409', async () => {
      const b = await seed({ status: 'CONFIRMED' });
      await setStatus(staffA, b.id, 'COMPLETED').expect(409);
    });

    it.each([
      ['PENDING', 'COMPLETED'],
      ['CANCELLED', 'CONFIRMED'],
      ['CANCELLED', 'PENDING'],
      ['COMPLETED', 'CANCELLED'],
      ['COMPLETED', 'CONFIRMED'],
      ['CONFIRMED', 'PENDING'],
      ['PENDING', 'PENDING'],
    ])('taqiqlangan o`tish %s -> %s -> 409', async (from, to) => {
      const b = await seed({ status: from, startTime: ago(120), endTime: ago(90) });
      const res = await setStatus(admin, b.id, to).expect(409);
      expect(res.body.statusCode).toBe(409);
    });

    it('noma`lum status qiymati -> 400', async () => {
      const b = await seed();
      await setStatus(admin, b.id, 'FOO').expect(400);
    });

    it('bekor qilingach slot bo`shaydi: shu vaqtga qayta bron qilish mumkin', async () => {
      const first = await book(customer).expect(201);
      await book(customer2).expect(409);
      await setStatus(customer, first.body.id, 'CANCELLED').expect(200);
      await book(customer2).expect(201);
    });
  });

  describe('PATCH /bookings/:id (ko`chirish)', () => {
    const patch = (u: TestUser, id: string, body: Record<string, unknown>) =>
      http().patch(`${API}/bookings/${id}`).set(bearer(u.token)).send(body);

    it('egasi PENDING bronni ko`chiradi: endTime qayta hisoblanadi', async () => {
      const b = await seed();
      const res = await patch(customer, b.id, { startTime: at(120) }).expect(200);
      expect(res.body.startTime).toBe(at(120));
      expect(res.body.endTime).toBe(at(150));
    });

    it('o`z eski slotiga qisman kesishgan holda siljitish mumkin (o`zi bilan to`qnashmaydi)', async () => {
      const b = await seed();
      await patch(customer, b.id, { startTime: at(10) }).expect(200);
    });

    it('boshqa bron bilan to`qnashsa -> 409', async () => {
      await seed({ customer: { id: customer2.id }, startTime: new Date(at(60)), endTime: new Date(at(90)) });
      const mine = await seed({ startTime: new Date(at(200)), endTime: new Date(at(230)) });
      await patch(customer, mine.id, { startTime: at(70) }).expect(409);
    });

    it('o`tmishga ko`chirib bo`lmaydi -> 400', async () => {
      const b = await seed();
      await patch(customer, b.id, { startTime: ago(60).toISOString() }).expect(400);
    });

    it('CONFIRMED yoki CANCELLED bronni ko`chirib bo`lmaydi -> 409', async () => {
      const c = await seed({ status: 'CONFIRMED' });
      const x = await seed({ status: 'CANCELLED', startTime: new Date(at(300)), endTime: new Date(at(330)) });
      await patch(customer, c.id, { startTime: at(500) }).expect(409);
      await patch(customer, x.id, { startTime: at(500) }).expect(409);
    });

    it('boshqa mijoz -> 404', async () => {
      const b = await seed();
      await patch(customer2, b.id, { startTime: at(500) }).expect(404);
    });

    it('faqat notes o`zgartirish mumkin', async () => {
      const b = await seed();
      const res = await patch(customer, b.id, { notes: 'updated' }).expect(200);
      expect(res.body.notes).toBe('updated');
      expect(res.body.startTime).toBe(at(0));
    });

    it('status/staffId/serviceId ni PATCH orqali o`zgartirib bo`lmaydi -> 400', async () => {
      const b = await seed();
      await patch(customer, b.id, { status: 'CONFIRMED' }).expect(400);
      await patch(customer, b.id, { staffId: staffB.staffId }).expect(400);
    });
  });
});
