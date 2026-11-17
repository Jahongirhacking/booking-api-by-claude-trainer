import { INestApplication } from '@nestjs/common';
import { existsSync } from 'fs';
import { resolve } from 'path';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { bearer, createAuthedUser, TestUser } from '../helpers/auth';
import { API, createTestApp } from '../m2/helpers/create-app';
import { createService } from '../m2/helpers/db';
import { cleanUploads, jpeg, listUploaded, MAX_BYTES, png, svg, textFile, uploadDir, webp } from './helpers/files';

describe('M6 | File upload (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let user: TestUser;
  let admin: TestUser;

  const http = () => request(app.getHttpServer());
  const avatar = (u: TestUser | null, buf: Buffer, filename = 'photo.png', contentType = 'image/png') => {
    const req = http().post(`${API}/users/me/avatar`);
    if (u) req.set(bearer(u.token));
    return req.attach('file', buf, { filename, contentType });
  };
  const serviceImage = (id: string, u: TestUser | null, buf: Buffer, filename = 'img.png', contentType = 'image/png') => {
    const req = http().post(`${API}/services/${id}/image`);
    if (u) req.set(bearer(u.token));
    return req.attach('file', buf, { filename, contentType });
  };
  const me = (u: TestUser) => http().get(`${API}/auth/me`).set(bearer(u.token));

  beforeEach(async () => {
    await cleanUploads();
    app = await createTestApp();
    ds = app.get(DataSource);
    user = await createAuthedUser(app);
    admin = await createAuthedUser(app, { role: 'ADMIN' });
  });

  afterEach(async () => {
    await app.close();
    await cleanUploads();
  });

  describe('POST /users/me/avatar', () => {
    it('tokensiz -> 401 va fayl saqlanmaydi', async () => {
      await avatar(null, png()).expect(401);
      expect(await listUploaded()).toHaveLength(0);
    });

    it('boshlang`ich holatda /auth/me avatarUrl = null', async () => {
      const res = await me(user).expect(200);
      expect(res.body.avatarUrl ?? null).toBeNull();
    });

    it.each([
      ['png', png, 'image/png', '.png'],
      ['jpeg', jpeg, 'image/jpeg', '.jpg|.jpeg'],
      ['webp', webp, 'image/webp', '.webp'],
    ])('%s yuklanadi -> 201, URL orqali qaytib olinadi (to`g`ri Content-Type va baytlar)', async (_t, make, mime, ext) => {
      const buf = make();
      const res = await avatar(user, buf, `photo.${_t}`, mime).expect(201);

      expect(res.body.avatarUrl).toMatch(new RegExp(`^/.+(${ext})$`));
      expect((await me(user)).body.avatarUrl).toBe(res.body.avatarUrl);
      expect(await listUploaded()).toHaveLength(1);

      const file = await http().get(res.body.avatarUrl).expect(200);
      expect(file.headers['content-type']).toMatch(new RegExp(`^${mime}`));
      expect(Buffer.compare(file.body, buf)).toBe(0);
    });

    it('saqlangan nom tasodifiy: asl nom URL da ko`rinmaydi; kengaytma aniqlangan turdan', async () => {
      const res = await avatar(user, png(), 'my secret photo.exe', 'image/png').expect(201);
      expect(res.body.avatarUrl).not.toMatch(/secret|photo/);
      expect(res.body.avatarUrl.endsWith('.png')).toBe(true);
    });

    it('path traversal ("../../evil.png"): fayl faqat upload papkasida saqlanadi', async () => {
      const res = await avatar(user, png(), '../../evil.png').expect(201);

      expect(res.body.avatarUrl).not.toMatch(/evil|\.\./);
      expect(await listUploaded()).toHaveLength(1);
      expect(existsSync(resolve(uploadDir(), '../../evil.png'))).toBe(false);
    });

    it.each([
      ['matn fayli', textFile(), 'notes.txt', 'text/plain'],
      ['matn, lekin image/png deb yuborilgan (soxta Content-Type)', textFile(), 'fake.png', 'image/png'],
      ['SVG (XSS xavfi)', svg(), 'logo.svg', 'image/svg+xml'],
      ['bo`sh fayl', Buffer.alloc(0), 'empty.png', 'image/png'],
    ])('%s -> 400 va diskda hech narsa qolmaydi', async (_l, buf, name, mime) => {
      await avatar(user, buf, name, mime).expect(400);
      expect(await listUploaded()).toHaveLength(0);
      expect((await me(user)).body.avatarUrl ?? null).toBeNull();
    });

    it('aynan 2 MB -> 201 (chegara kiradi)', async () => {
      await avatar(user, png(MAX_BYTES)).expect(201);
    });

    it('2 MB + 1 bayt -> 413 va diskda hech narsa qolmaydi', async () => {
      const res = await avatar(user, png(MAX_BYTES + 1)).expect(413);
      expect(res.body.statusCode).toBe(413);
      expect(await listUploaded()).toHaveLength(0);
    });

    it('fayl yuborilmasa -> 400', async () => {
      await http().post(`${API}/users/me/avatar`).set(bearer(user.token)).expect(400);
    });

    it('noto`g`ri field nomi ("avatar" o`rniga "file" kerak) -> 400', async () => {
      await http()
        .post(`${API}/users/me/avatar`)
        .set(bearer(user.token))
        .attach('avatar', png(), { filename: 'a.png', contentType: 'image/png' })
        .expect(400);
    });

    it('bir nechta fayl -> 400', async () => {
      await http()
        .post(`${API}/users/me/avatar`)
        .set(bearer(user.token))
        .attach('file', png(), { filename: 'a.png', contentType: 'image/png' })
        .attach('file', png(), { filename: 'b.png', contentType: 'image/png' })
        .expect(400);
      expect(await listUploaded()).toHaveLength(0);
    });

    it('qayta yuklash eski faylni diskdan o`chiradi (yetim fayllar to`planmaydi)', async () => {
      const first = await avatar(user, png()).expect(201);
      const second = await avatar(user, jpeg(), 'b.jpg', 'image/jpeg').expect(201);

      expect(second.body.avatarUrl).not.toBe(first.body.avatarUrl);
      expect(await listUploaded()).toHaveLength(1);
      await http().get(first.body.avatarUrl).expect(404);
      await http().get(second.body.avatarUrl).expect(200);
    });

    it('bir foydalanuvchi avatari boshqasiga ta`sir qilmaydi', async () => {
      await avatar(user, png()).expect(201);
      expect((await me(admin)).body.avatarUrl ?? null).toBeNull();
    });
  });

  describe('DELETE /users/me/avatar', () => {
    it('204, fayl diskdan o`chadi, avatarUrl = null', async () => {
      const up = await avatar(user, png()).expect(201);
      await http().delete(`${API}/users/me/avatar`).set(bearer(user.token)).expect(204);

      expect(await listUploaded()).toHaveLength(0);
      expect((await me(user)).body.avatarUrl ?? null).toBeNull();
      await http().get(up.body.avatarUrl).expect(404);
    });

    it('avatar yo`q bo`lsa ham 204 (idempotent)', async () => {
      await http().delete(`${API}/users/me/avatar`).set(bearer(user.token)).expect(204);
    });

    it('tokensiz -> 401', async () => {
      await http().delete(`${API}/users/me/avatar`).expect(401);
    });
  });

  describe('POST /services/:id/image (faqat ADMIN)', () => {
    it.each([
      ['anonim', 401],
      ['customer', 403],
    ])('%s -> %i', async (who, status) => {
      const s = await createService(ds);
      await serviceImage(s.id, who === 'anonim' ? null : user, png()).expect(status);
      expect(await listUploaded()).toHaveLength(0);
    });

    it('admin yuklaydi -> 201 {imageUrl}; GET /services/:id da ko`rinadi', async () => {
      const s = await createService(ds);
      const res = await serviceImage(s.id, admin, png()).expect(201);

      expect(res.body.imageUrl).toMatch(/^\/.+\.png$/);
      const got = await http().get(`${API}/services/${s.id}`).expect(200);
      expect(got.body.imageUrl).toBe(res.body.imageUrl);
      await http().get(res.body.imageUrl).expect(200);
    });

    it('rasm yuklanmagan xizmatda imageUrl = null', async () => {
      const s = await createService(ds);
      const got = await http().get(`${API}/services/${s.id}`).expect(200);
      expect(got.body.imageUrl ?? null).toBeNull();
    });

    it('mavjud bo`lmagan xizmat -> 404 va fayl saqlanmaydi', async () => {
      await serviceImage('3f2b8c1e-5a4d-4e7b-9c1a-0d2e6f8a1b3c', admin, png()).expect(404);
      expect(await listUploaded()).toHaveLength(0);
    });

    it('uuid noto`g`ri -> 400', async () => {
      await serviceImage('abc', admin, png()).expect(400);
    });

    it('noto`g`ri fayl turi -> 400', async () => {
      const s = await createService(ds);
      await serviceImage(s.id, admin, textFile(), 'x.png', 'image/png').expect(400);
      expect(await listUploaded()).toHaveLength(0);
    });

    it('qayta yuklash eskisini o`chiradi', async () => {
      const s = await createService(ds);
      await serviceImage(s.id, admin, png()).expect(201);
      await serviceImage(s.id, admin, webp(), 'b.webp', 'image/webp').expect(201);
      expect(await listUploaded()).toHaveLength(1);
    });

    it('xizmat o`chirilsa, rasm fayli ham o`chadi', async () => {
      const s = await createService(ds);
      await serviceImage(s.id, admin, png()).expect(201);
      await http().delete(`${API}/services/${s.id}`).set(bearer(admin.token)).expect(204);
      expect(await listUploaded()).toHaveLength(0);
    });
  });
});
