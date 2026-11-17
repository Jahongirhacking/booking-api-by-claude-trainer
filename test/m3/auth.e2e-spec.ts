import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createAuthedUser, bearer } from '../helpers/auth';
import { API, createTestApp } from '../m2/helpers/create-app';

const decode = (token: string) =>
  JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));

describe('M3 | Authentication (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let jwt: JwtService;

  const valid = { email: 'ali@test.com', fullName: 'Ali Valiyev', password: 'Passw0rd!123' };
  const http = () => request(app.getHttpServer());
  const register = (o: Record<string, unknown> = {}) =>
    http().post(`${API}/auth/register`).send({ ...valid, ...o });
  const login = (o: Record<string, unknown> = {}) =>
    http()
      .post(`${API}/auth/login`)
      .send({ email: valid.email, password: valid.password, ...o });
  const me = (headers: Record<string, string> = {}) => http().get(`${API}/auth/me`).set(headers);

  beforeEach(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);
    jwt = app.get(JwtService, { strict: false });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('201: id, email, fullName, role=CUSTOMER qaytaradi; parol/hash qaytarmaydi', async () => {
      const res = await register().expect(201);

      expect(res.body).toMatchObject({
        email: 'ali@test.com',
        fullName: 'Ali Valiyev',
        role: 'CUSTOMER',
      });
      expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(JSON.stringify(res.body)).not.toMatch(/password/i);
    });

    it('parol DB da hash ko`rinishida saqlanadi (bcrypt), ochiq emas', async () => {
      const res = await register().expect(201);
      const row = await ds.getRepository('User').findOneByOrFail({ id: res.body.id });

      expect(row.passwordHash).not.toBe(valid.password);
      expect(row.passwordHash).toMatch(/^\$2[aby]\$/);
    });

    it('email trim va kichik harfga o`tkaziladi', async () => {
      const res = await register({ email: '  ALI@Test.COM ' }).expect(201);
      expect(res.body.email).toBe('ali@test.com');
    });

    it('takroriy email -> 409 (katta-kichik harf farqsiz)', async () => {
      await register().expect(201);
      const res = await register({ email: 'ALI@test.com' }).expect(409);
      expect(res.body.statusCode).toBe(409);
    });

    it('72 belgili parol ruxsat etiladi (bcrypt chegarasi)', async () => {
      await register({ password: 'a'.repeat(72) }).expect(201);
    });

    it.each([
      ['email noto`g`ri', { email: 'not-an-email' }],
      ['email yo`q', { email: undefined }],
      ['fullName yo`q', { fullName: undefined }],
      ['fullName bo`sh', { fullName: '' }],
      ['fullName 100 belgidan uzun', { fullName: 'a'.repeat(101) }],
      ['password yo`q', { password: undefined }],
      ['password 7 belgi', { password: 'Ab1!xyz' }],
      ['password 73 belgi (bcrypt 72 baytdan keyin kesadi)', { password: 'a'.repeat(73) }],
      ['password son', { password: 12345678 }],
      ['role yuborildi (privilege escalation)', { role: 'ADMIN' }],
      ['passwordHash yuborildi', { passwordHash: 'x' }],
    ])('validatsiya: %s -> 400', async (_l, overrides) => {
      await register(overrides).expect(400);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await register().expect(201);
    });

    it('200: JWT accessToken qaytaradi, payload.sub = user.id', async () => {
      const reg = await ds.getRepository('User').findOneByOrFail({ email: valid.email });
      const res = await login().expect(200);

      expect(res.body.accessToken.split('.')).toHaveLength(3);
      const payload = decode(res.body.accessToken);
      expect(payload.sub).toBe(reg.id);
      expect(typeof payload.exp).toBe('number');
      expect(JSON.stringify(payload)).not.toMatch(/password|hash/i);
    });

    it('email katta-kichik harfga sezgir emas', async () => {
      await login({ email: 'ALI@TEST.COM' }).expect(200);
    });

    it('noto`g`ri parol -> 401', async () => {
      await login({ password: 'WrongPass123' }).expect(401);
    });

    it('mavjud bo`lmagan email -> 401 va xabar noto`g`ri parol bilan BIR XIL (user enumeration yo`q)', async () => {
      const wrongPass = await login({ password: 'WrongPass123' }).expect(401);
      const unknown = await login({ email: 'ghost@test.com' }).expect(401);
      expect(unknown.body.message).toEqual(wrongPass.body.message);
    });

    it.each([
      ['email yo`q', { email: undefined }],
      ['password yo`q', { password: undefined }],
      ['email noto`g`ri format', { email: 'abc' }],
    ])('validatsiya: %s -> 400', async (_l, overrides) => {
      await login(overrides).expect(400);
    });
  });

  describe('GET /auth/me (JwtAuthGuard)', () => {
    it('to`g`ri token bilan 200 va profil (parolsiz)', async () => {
      const user = await createAuthedUser(app, { email: 'bob@test.com', fullName: 'Bob' });
      const res = await me(bearer(user.token)).expect(200);

      expect(res.body).toMatchObject({ id: user.id, email: 'bob@test.com', fullName: 'Bob', role: 'CUSTOMER' });
      expect(JSON.stringify(res.body)).not.toMatch(/password/i);
    });

    it('token yo`q -> 401', async () => {
      await me().expect(401);
    });

    it('yaroqsiz token -> 401', async () => {
      await me({ Authorization: 'Bearer abc.def.ghi' }).expect(401);
    });

    it('Bearer o`rniga Basic sxema -> 401', async () => {
      const user = await createAuthedUser(app);
      await me({ Authorization: `Basic ${user.token}` }).expect(401);
    });

    it('muddati o`tgan token -> 401', async () => {
      const user = await createAuthedUser(app);
      const expired = jwt.sign({ sub: user.id }, { expiresIn: -60 });
      await me(bearer(expired)).expect(401);
    });

    it('boshqa secret bilan imzolangan token -> 401', async () => {
      const user = await createAuthedUser(app);
      const forged = jwt.sign({ sub: user.id }, { secret: 'completely-different-secret-value' });
      await me(bearer(forged)).expect(401);
    });

    it('imzosi o`zgartirilgan token -> 401', async () => {
      const user = await createAuthedUser(app);
      const [h, p, s] = user.token.split('.');
      const tampered = `${h}.${p}.${(s[0] === 'A' ? 'B' : 'A') + s.slice(1)}`;
      await me(bearer(tampered)).expect(401);
    });

    it('alg:none token -> 401', async () => {
      const user = await createAuthedUser(app);
      const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
      const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: user.id })}.`;
      await me(bearer(none)).expect(401);
    });

    it('user o`chirilgan bo`lsa, eski token -> 401', async () => {
      const user = await createAuthedUser(app);
      await ds.getRepository('User').delete(user.id);
      await me(bearer(user.token)).expect(401);
    });
  });

  describe('Ochiq route`lar ochiq qoladi', () => {
    it('GET /health va GET /services tokensiz ishlaydi', async () => {
      await http().get(`${API}/health`).expect(200);
      await http().get(`${API}/services`).expect(200);
    });
  });
});
