import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { API, createTestApp } from './helpers/create-app';
import { createBooking, sleep } from './helpers/db';

describe('M2 | Services + PostgreSQL (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  const url = `${API}/services`;
  const payload = { name: 'Haircut', description: 'Classic', durationMinutes: 30, price: 50000 };

  const http = () => request(app.getHttpServer());
  const post = (o: Record<string, unknown> = {}) => http().post(url).send({ ...payload, ...o });

  beforeEach(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST: yozuv haqiqatan ham bazaga yoziladi, id uuid', async () => {
    const res = await post().expect(201);
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);

    const row = await ds.getRepository('Service').findOneBy({ id: res.body.id });
    expect(row).not.toBeNull();
    expect(row!.name).toBe('Haircut');
  });

  it('ma`lumot ilova qayta ishga tushganda ham saqlanadi', async () => {
    const created = await post().expect(201);
    await app.close();

    app = await createTestApp({ reset: false });
    const res = await http().get(`${url}/${created.body.id}`).expect(200);
    expect(res.body.name).toBe('Haircut');
  });

  it('price API orqali ham NUMBER bo`lib qaytadi (49999.99)', async () => {
    const created = await post({ price: 49999.99 }).expect(201);
    expect(created.body.price).toBe(49999.99);

    const got = await http().get(`${url}/${created.body.id}`).expect(200);
    expect(typeof got.body.price).toBe('number');
    expect(got.body.price).toBe(49999.99);

    const list = await http().get(url).expect(200);
    expect(list.body[0].price).toBe(49999.99);
  });

  it('GET /services: createdAt bo`yicha o`sish tartibida (A, B, C)', async () => {
    for (const name of ['A', 'B', 'C']) {
      await post({ name }).expect(201);
      await sleep(5);
    }
    const res = await http().get(url).expect(200);
    expect(res.body.map((s: { name: string }) => s.name)).toEqual(['A', 'B', 'C']);
  });

  it('PATCH: updatedAt o`zgaradi, createdAt o`zgarmaydi', async () => {
    const created = await post().expect(201);
    await sleep(20);
    const res = await http().patch(`${url}/${created.body.id}`).send({ price: 1 }).expect(200);

    expect(new Date(res.body.updatedAt).getTime()).toBeGreaterThan(
      new Date(created.body.updatedAt).getTime(),
    );
    expect(res.body.createdAt).toBe(created.body.createdAt);
  });

  it('DELETE: yozuv bazadan haqiqatan o`chadi', async () => {
    const created = await post().expect(201);
    await http().delete(`${url}/${created.body.id}`).expect(204);
    expect(await ds.getRepository('Service').countBy({ id: created.body.id })).toBe(0);
  });

  it('bir vaqtda ikkita bir xil nom: bittasi 201, boshqasi 409 (500 emas!), bazada 1 ta yozuv', async () => {
    const results = await Promise.all([post({ name: 'Race' }), post({ name: 'Race' })]);
    const statuses = results.map((r) => r.status).sort();

    expect(statuses).toEqual([201, 409]);
    expect(await ds.getRepository('Service').countBy({ name: 'Race' })).toBe(1);
  });

  it('booking bog`langan xizmatni o`chirish -> 409 va xizmat saqlanib qoladi', async () => {
    const created = await post().expect(201);
    const service = await ds.getRepository('Service').findOneByOrFail({ id: created.body.id });
    await createBooking(ds, { service });

    const res = await http().delete(`${url}/${created.body.id}`).expect(409);
    expect(res.body.statusCode).toBe(409);
    expect(await ds.getRepository('Service').countBy({ id: created.body.id })).toBe(1);
  });
});
