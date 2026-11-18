# TOPSHIRIQ: Booking & Reservation API (NestJS + PostgreSQL)

> **Til:** o'zbekcha. **Maqsad:** tayyor yozilgan testlarni (`test/` papkasi) birin-ketin **yashil** qiladigan backend yozish.
> **Qoida:** testlarni **o'zgartirmaysiz**. Faqat `src/`, migratsiyalar, konfiguratsiya va `package.json` skriptlarini yozasiz.
> Bu hujjat har bir milestone uchun **nima qilish kerakligini** va **har bir test nimani tekshirishini** to'liq sanab beradi.
> Qisqa talablar (shartnomalar jadvali) `docs/milestones.md` da (M3–M7). M1 va M2 talablari faqat testlardan kelib chiqadi, ular shu hujjatda yozilgan.

---

## 0. Umumiy ko'rinish

Siz salon/klinika kabi joylar uchun **bron qilish (booking) API** yozasiz:

- **Xizmatlar (Service)** — masalan "Haircut", davomiyligi va narxi bor.
- **Xodimlar (Staff)** — xizmat ko'rsatuvchi, bitta foydalanuvchiga bog'langan.
- **Foydalanuvchilar (User)** — rollar: `ADMIN`, `STAFF`, `CUSTOMER`.
- **Bronlar (Booking)** — mijoz + xodim + xizmat + vaqt oralig'i, holat (`PENDING → CONFIRMED → COMPLETED`, yoki `CANCELLED`).

Ishlash yo'li 7 ta milestone (M1 → M7). Har biri o'zidan oldingilarni ham qamrab oladi (regressiya).

| Milestone | Mavzu | Test buyrug'i | Qamrab oladi | DB kerakmi |
|---|---|---|---|---|
| M1 | Services CRUD (xotirada), validatsiya, xato filtri, global prefix | `pnpm run test:m1` | M1 | Yo'q |
| M2 | PostgreSQL, TypeORM entitylar, migratsiyalar | `pnpm run test:m2` | M1 + M2 | Ha |
| M3 | Authentication (JWT, bcrypt) | `pnpm run test:m3` | M1–M3 | Ha |
| M4 | Booking biznes logikasi (overlap, race, state machine) | `pnpm run test:m4` | M1–M4 | Ha |
| M5 | RBAC, middleware, interceptor, pipe, filter | `pnpm run test:m5` | M1–M5 | Ha |
| M6 | Fayl yuklash (avatar, xizmat rasmi) | `pnpm run test:m6` | M1–M6 | Ha |
| M7 | Yakuniy integratsiya va xavfsizlik | `pnpm run test:m7` | M1–M7 | Ha |

**Muhim eslatma (M2 dan boshlab):** `M1` dagi `services.service.spec.ts` (unit, xotirada saqlash) M2 dan boshlab **ishga tushirilmaydi** (`jest-m2..m7.json` da `testPathIgnorePatterns` orqali chiqarib tashlangan), chunki `ServicesService` DB ga o'tadi.

---

## 1. Tayyorgarlik

### 1.1. Hozirgi holat (boshlang'ich repo)

Repo — NestJS starter + tayyor testlar. Sizga quyidagilar ma'lum bo'lishi kerak:

1. `src/app.setup.ts` hozir `appSetup` nomli funksiya eksport qiladi. **Testlar `configureApp` nomini import qiladi** (`import { configureApp } from '../../../src/app.setup'`). Shuning uchun funksiyani `configureApp(app: INestApplication)` deb qayta nomlang va `main.ts` ham shuni chaqirsin. Testlar `main.ts` ni ishlatmaydi, shuning uchun **butun global sozlama `configureApp` ichida** bo'lishi shart:
   - global prefix `api/v1`;
   - `ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })`;
   - global exception filter (M1 dan);
   - global interceptor (M5);
   - (middleware ni `AppModule.configure()` ga yoki `configureApp` ga qo'yishingiz mumkin).
2. Starter fayllar (`test/app.e2e-spec.ts` — `GET /` → `Hello World!` kutadi, `AppController`) endi mos kelmaydi. Prefiks tufayli `GET /` 404 bo'ladi. `test/app.e2e-spec.ts` va `test/jest-e2e.json` / `test:e2e` skripti topshiriqning bir qismi emas — ularga tayanmang, `test:mN` skriptlaridan foydalaning.
3. `package.json` da hozircha `test:m1 … test:m7` skriptlari **yo'q**. Ularni qo'shasiz (1.4-bo'lim).

### 1.2. Paketlar

```bash
# M1
pnpm add class-validator class-transformer
# M2
pnpm add @nestjs/typeorm typeorm pg @nestjs/config
pnpm add -D dotenv            # test/setup/env.ts ishlatadi
# M3
pnpm add @nestjs/passport passport passport-jwt @nestjs/jwt bcrypt
pnpm add -D @types/passport-jwt @types/bcrypt
# M6
pnpm add -D @types/multer
pnpm add @nestjs/serve-static   # ixtiyoriy: statik fayl berish uchun (boshqa yo'l ham bo'ladi)
```

### 1.3. PostgreSQL va muhit o'zgaruvchilari

M2 dan boshlab testlar **haqiqiy PostgreSQL** ishlatadi. Masalan Docker bilan:

```bash
docker run --name booking-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
docker exec -it booking-pg psql -U postgres -c "CREATE DATABASE booking_dev;"
docker exec -it booking-pg psql -U postgres -c "CREATE DATABASE booking_test;"
```

Repo ildizida **`.env.test`** (gitga kirmaydi!) yarating. Quyidagi nomlar tavsiya; **faqat `DB_NAME` nomi majburiy** (testlar uni o'qiydi), qolganlarini `src/database/data-source.ts` o'zingiz o'qiysiz:

```
NODE_ENV=test
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=booking_test

# M3 dan boshlab:
JWT_SECRET=test-secret-at-least-32-characters-long
JWT_EXPIRES_IN=1h
BCRYPT_ROUNDS=4
UPLOAD_DIR=./uploads-test
```

Xuddi shu o'zgaruvchilar `.env` (boshqa qiymatlar, `DB_NAME=booking_dev`) va `.env.example` (maxfiy qiymatsiz) uchun ham kerak. `.gitignore` ga: `.env`, `.env.test`, `uploads/`, `uploads-test/`.

**Xavfsizlik qo'riqchilari (testlar o'zi tekshiradi):**
- `test/setup/db-guard.ts`: `NODE_ENV === 'test'` va `DB_NAME` `_test` bilan tugamasa — testlar darhol to'xtaydi (chunki `global-setup` `dropDatabase()` chaqiradi!).
- `test/m6/helpers/files.ts`: `UPLOAD_DIR` yo'lida `test` so'zi bo'lmasa — to'xtaydi (haqiqiy papkani o'chirib yubormaslik uchun).

### 1.4. `package.json` skriptlari

```json
"test:m1": "jest --config ./test/jest-m1.json --runInBand",
"test:m2": "jest --config ./test/jest-m2.json --runInBand",
"test:m3": "jest --config ./test/jest-m3.json --runInBand",
"test:m4": "jest --config ./test/jest-m4.json --runInBand",
"test:m5": "jest --config ./test/jest-m5.json --runInBand",
"test:m6": "jest --config ./test/jest-m6.json --runInBand",
"test:m7": "jest --config ./test/jest-m7.json --runInBand",
"migration:run": "...",
"migration:revert": "...",
"migration:generate": "..."
```

Migratsiya skriptlari (typeorm CLI + `ts-node` bilan `src/database/data-source.ts` ga ishora qiladi) M2 da yoziladi; M7 da `migration:run` / `migration:revert` bo'sh bazada ishlashi tekshiriladi.

`--runInBand` majburiy: barcha test fayllari bitta bazani baham ko'radi.

### 1.5. Tavsiya etilgan papka tuzilmasi

```
src/
  main.ts, app.module.ts, app.setup.ts
  common/            (filter, interceptor, middleware, pipe-lar)
  database/          data-source.ts, migrations/
  health/
  services/          (entity, dto, controller, service)
  users/  staff/
  auth/              password.ts, decorators/roles.decorator.ts, guards/roles.guard.ts, strategies/jwt.strategy.ts
  bookings/          booking.rules.ts, booking.entity.ts, ...
  uploads/           image-type.ts, storage.service.ts
```

Majburiy bo'lgan yo'llar (testlar import qiladi): `src/app.module.ts`, `src/app.setup.ts` (`configureApp`), `src/services/services.service.ts` (M1), `src/database/data-source.ts` (default export `DataSource`), `src/auth/password.ts`, `src/auth/decorators/roles.decorator.ts`, `src/auth/guards/roles.guard.ts`, `src/bookings/booking.rules.ts`, `src/uploads/image-type.ts`.

### 1.6. Test infratuzilmasi (nima nima qiladi)

| Fayl | Vazifasi |
|---|---|
| `test/setup/env.ts` | Har test faylidan oldin `.env.test` ni majburan yuklaydi, `NODE_ENV=test`, DB guard'ni ishga tushiradi. |
| `test/setup/global-setup.ts` | Barcha testlardan oldin **bir marta**: test bazasini `dropDatabase()` qiladi va `runMigrations()` ni noldan ishga tushiradi. Demak sxema **faqat migratsiyalardan** yaratilishi shart (`synchronize` ishlamaydi). |
| `test/m1/helpers/create-app.ts` | M1: `AppModule` + `configureApp` bilan yangi ilova; TypeORM bo'lsa jadvallarni `TRUNCATE` qiladi, bo'lmasa indamaydi. |
| `test/m2/helpers/create-app.ts` | M2+ : yangi ilova + `truncateAll`. `reset:false` — "qayta ishga tushganda ma'lumot saqlanadimi" testi uchun. |
| `test/m2/helpers/db.ts` | `createUser/Service/Staff/Booking` — to'g'ridan-to'g'ri DB ga yozadi (entitylarni **nomi bilan**: `'User'`, `'Service'`, `'Staff'`, `'Booking'`). |
| `test/helpers/auth.ts` | `createAuthedUser` — haqiqiy `/auth/register` + (kerak bo'lsa) DB da rolni o'zgartirish + `/auth/login`. `createStaffUser` — STAFF user + `Staff` profili. |
| `test/helpers/admin-headers.ts` | M1/M2 testlari uchun: `/auth/register` 404 bo'lsa bo'sh header; bo'lmasa ADMIN token. |
| `test/helpers/time.ts` | `at(min)` = bugundan +30 kun, 10:00 UTC dan `min` daqiqa keyin (ISO); `ago(min)` — o'tmishdagi `Date`. |
| `test/m6/helpers/files.ts` | Sun'iy PNG/JPEG/WEBP (faqat magic bytes), matn, SVG; `listUploaded()`, `cleanUploads()`. |

---

## 2. Ishlash tartibi

Har bir milestone uchun:

1. Shu hujjatdagi bo'limni va tegishli test fayllarini o'qing.
2. Kodni yozing. Avval `pnpm run test:mN` ni ishga tushirib, qizil testlardan boshlang.
3. `pnpm run test:mN` **to'liq yashil** bo'lganda (oldingi milestone'lar ham!) commit qiling.
4. Keyingi milestone'ga o'ting. Hech qachon oldingi testni "buzib" o'tmang.

Commit xabarlari (M3–M7 tayyor, M1–M2 tavsiya):

| M | Commit |
|---|---|
| M1 | `feat(m1): services CRUD with validation, exception filter and global prefix` |
| M2 | `feat(m2): postgres, typeorm entities and migrations` |
| M3 | `feat(m3): register/login with bcrypt and JWT, JwtAuthGuard, /auth/me` |
| M4 | `feat(m4): booking creation with overlap protection, status machine, role-scoped visibility` |
| M5 | `feat(m5): roles guard, admin endpoints, request-id middleware, response-time interceptor` |
| M6 | `feat(m6): avatar and service image upload with magic-byte validation and storage service` |
| M7 | `chore(m7): final integration, security hardening and docs` |

---

## M1. Services CRUD (xotirada), validatsiya, xato filtri

**Maqsad:** NestJS asoslari — modul/controller/service, DTO + `ValidationPipe`, `ParseUUIDPipe`, exception filter, global prefix.

### Nima qilish kerak

1. `configureApp` (1.1-bo'lim): prefiks `api/v1`, `ValidationPipe` (`transform`, `whitelist`, `forbidNonWhitelisted`).
2. **`GET /api/v1/health`** → 200 `{ status: 'ok', timestamp: <ISO> }`.
3. **Services CRUD** (`/api/v1/services`). Hozircha **xotirada** (Map/Array). Hozircha autentifikatsiya yo'q.

   | Method | Path | Natija |
   |---|---|---|
   | POST | `/services` | 201 — yaratilgan xizmat (`id`, `createdAt`, ...) |
   | GET | `/services` | 200 — massiv |
   | GET | `/services/:id` | 200 / 404 / 400 (uuid emas) |
   | PATCH | `/services/:id` | 200 / 404 / 400 / 409 |
   | DELETE | `/services/:id` | 204 (body bo'sh) / 404 / 400 |

4. **CreateServiceDto**: `name` (string, trim, 1–100 belgi, probel-only bo'lmasin), `description` (ixtiyoriy string), `durationMinutes` (butun son, 5–480), `price` (son, ≥ 0; 0 ruxsat). **UpdateServiceDto** — hammasi ixtiyoriy (`PartialType`).
5. **Nom noyob**, **katta-kichik harfga e'tiborsiz** ("Haircut" va "HAIRCUT" — 409).
6. **Global Exception Filter**: barcha xatolar `{ statusCode, message, path, timestamp }` shaklida (`timestamp` — yaroqli ISO sana, `path` — so'rov yo'li, masalan `/api/v1/services/<uuid>`).
7. **Shartnoma (unit test shunga tayanadi):** `src/services/services.service.ts` → `ServicesService` klassi; metodlari: `create(dto)`, `findAll()`, `findOne(id)`, `update(id, dto)`, `remove(id)` (Promise qaytarishi mumkin — testlar `await` qiladi). `Test.createTestingModule({ providers: [ServicesService] })` bilan **boshqa providersiz** yaratilishi kerak (M1 da hech qanday repository/injection bo'lmasin). Topilmasa `NotFoundException`, nom takror bo'lsa `ConflictException` tashlaydi.

### Testlar (barcha tekshiruvlar)

#### `test/m1/health.e2e-spec.ts`
| # | Tekshiruv | Kutilgan natija |
|---|---|---|
| 1 | `GET /api/v1/health` | 200; `status === 'ok'`; `timestamp` — satr va yaroqli sana |
| 2 | `GET /health` (prefikssiz) | 404 |
| 3 | `GET /api/v1/unknown-route` | 404; `statusCode===404`, `message` bor, `path === '/api/v1/unknown-route'`, `timestamp` yaroqli sana |

#### `test/m1/services.e2e-spec.ts` — POST /services
| # | Tekshiruv | Kutilgan natija |
|---|---|---|
| 4 | To'g'ri ma'lumot bilan | 201; `name, description, durationMinutes, price` mos; `id` — string; `createdAt` bor |
| 5 | `description` yuborilmasa | 201 (ixtiyoriy) |
| 6 | `name: '  Massage  '` | 201; `name === 'Massage'` (trim) |
| 7–20 | **Validatsiya (14 ta holat):** `name` yo'q / bo'sh / faqat probel / 101 belgi / son (123); `durationMinutes` yo'q / `'abc'` / 0 / 4 / 481 / 7.5; `price` yo'q / -1 / `'free'` | har biri 400; body da `statusCode===400`, `message` bor |
| 21 | `price: 0` | 201 (ruxsat) |
| 22 | Noma'lum maydon (`isAdmin: true`) | 400 (`forbidNonWhitelisted`) |
| 23 | Nom takrori (`Haircut` keyin `HAIRCUT`) | birinchisi 201, ikkinchisi 409, `statusCode===409` |

#### GET /services
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 24 | Boshida | 200, `[]` |
| 25 | A va B yaratgach | 200, uzunligi 2 |

#### GET /services/:id
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 26 | Mavjud id | 200; `id` va `name` mos |
| 27 | Mavjud bo'lmagan uuid | 404; `statusCode===404` |
| 28 | `not-a-uuid` | **400** (404 emas) → `ParseUUIDPipe` |

#### PATCH /services/:id
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 29 | `{ price: 70000 }` | 200; `price` yangilanadi, `name` va `durationMinutes` o'zgarmaydi |
| 30 | Bo'sh body `{}` | 200, ma'lumot o'zgarmaydi |
| 31 | `{ durationMinutes: 0 }` | 400 |
| 32 | `{ foo: 'bar' }` | 400 |
| 33 | Mavjud bo'lmagan id | 404 |
| 34 | `/services/abc` | 400 |
| 35 | Boshqa xizmat nomini olish (`B` → `a`) | 409 |
| 36 | O'z nomini qayta yuborish | 200 (o'zi bilan to'qnashmaydi) |

#### DELETE /services/:id
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 37 | Mavjud xizmat | 204, body `{}`; keyingi `GET` → 404 |
| 38 | Mavjud bo'lmagan id | 404 |
| 39 | `/services/xyz` | 400 |

#### Yagona xato formati
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 40 | 404 javob | `statusCode`, `message`, `path === url`, `timestamp` yaroqli |
| 41 | Validatsiya xatosi (`price: -5`) | 400; `path === '/api/v1/services'`, `timestamp` bor |

#### `test/m1/services.service.spec.ts` (unit, 13 ta)
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 42 | `create` | `id` (string), `name`, `durationMinutes`, `price`, `createdAt` qaytaradi |
| 43 | Ikki `create` | `id` lar har xil |
| 44 | `create` nom takrori (`haircut`) | `ConflictException` |
| 45 | `findAll` boshida | `[]` |
| 46 | `findAll` 2 ta yaratgach | uzunligi 2 |
| 47 | `findOne` mavjud | shu xizmatni qaytaradi |
| 48 | `findOne('does-not-exist')` | `NotFoundException` |
| 49 | `update` faqat `price` | `price` o'zgaradi, boshqalar o'zgarmaydi |
| 50 | `update` o'z nomini qayta yuborish | Conflict bermaydi |
| 51 | `update` boshqa nomni olish | `ConflictException` |
| 52 | `update('nope', ...)` | `NotFoundException` |
| 53 | `remove` | o'chiriladi, keyin `findOne` → `NotFoundException` |
| 54 | `remove('nope')` | `NotFoundException` |

> Unit testda id `'does-not-exist'` (uuid emas) bilan `NotFoundException` kutiladi — uuid tekshiruvi **servisda emas, controllerdagi pipe da** bo'lsin.

### Qabul mezonlari (M1)
- [ ] `pnpm run test:m1` yashil.
- [ ] Biznes mantiq controllerda emas, servisda.
- [ ] Filter global; `message` har doim mavjud.

---

## M2. PostgreSQL, TypeORM entitylar, migratsiyalar

**Maqsad:** `ServicesService` ni xotiradan PostgreSQL ga o'tkazish; 4 ta entity; sxemani **faqat migratsiya** bilan boshqarish; DB xatolarini HTTP ga to'g'ri xaritalash.

### Nima qilish kerak

1. **`src/database/data-source.ts`** — `export default new DataSource({...})`. Testlar uni to'g'ridan-to'g'ri import qiladi (`global-setup` ham). Talablar:
   - `.env` / `.env.test` dan sozlama oladi (test muhitida `DB_NAME` `_test` bilan tugaydi);
   - `synchronize: false` (`false` yoki `undefined`);
   - entity va migratsiya yo'llari `ts-jest` ostida ham ishlaydigan glob (masalan `src/**/*.entity.ts`, `src/database/migrations/*.ts`);
   - migratsiya jadvali default (`migrations`).
2. `AppModule` da `TypeOrmModule.forRoot/Async` — xuddi shu sozlamalar bilan. `DataSource` DI orqali olinadigan bo'lsin (`app.get(DataSource)`).
3. **Entitylar** (klass nomlari aynan shunday bo'lishi shart: `User`, `Service`, `Staff`, `Booking`):

   **User**: `id` (uuid, PK), `email` (**unique**), `fullName`, `passwordHash`, `role` (`ADMIN | STAFF | CUSTOMER`, **default `CUSTOMER`**; noto'g'ri qiymat **DB tomonidan** rad etilsin → Postgres `enum` yoki `CHECK`), `createdAt`.

   **Service**: `id` (uuid), `name` (**unique**), `description` (nullable), `durationMinutes` (int), `price` (**`decimal`** ustun, lekin JS da **`number`** — `transformer` yozing), `createdAt`, `updatedAt` (`@UpdateDateColumn`, update qilganda o'zgaradi; `createdAt` o'zgarmaydi).

   **Staff**: `id`, `user` (**OneToOne** → `User`, `JoinColumn`; bitta user ikki marta staff bo'lolmaydi → unique), `specialization` (nullable), `isActive` (default `true`).

   **Booking**: `id`, `customer` (ManyToOne → User), `staff` (ManyToOne → Staff), `service` (ManyToOne → Service), `startTime`, `endTime` (**`timestamptz`**), `status` (`PENDING | CONFIRMED | CANCELLED | COMPLETED`, default `PENDING`), `notes` (nullable), `createdAt`, `updatedAt`. **`CHECK (endTime > startTime)`**. FK lar `RESTRICT`/`NO ACTION` (bog'liq yozuvni o'chirib bo'lmasin).
4. **Migratsiya(lar)** — sxemani yaratadi (`up`) va to'liq qaytaradi (`down`: jadvallar **o'chadi**; enum turlarini ham o'chirishni unutmang). `migration:generate` dan foydalansangiz ham `down` ni tekshiring.
5. **`GET /health`** endi `{ status: 'ok', database: 'up', timestamp }` (DB ga oddiy `SELECT 1` bilan tekshiradi).
6. **`ServicesService`** → `Repository<Service>` ishlatadi:
   - `GET /services` — `createdAt` o'sish tartibida;
   - nom takrori — 409. Katta-kichik harf farqsizligi (M1 talabi) uchun servisda `LOWER(name)` bilan tekshiring, **va** unique-violation (`23505`) ni ushlab 409 ga aylantiring (parallel so'rovlar uchun);
   - booking bog'langan xizmatni o'chirish → FK xatosi (`23503`) → **409** (500 emas);
   - `price` API orqali ham `number` bo'lib qaytsin.
7. **DB xatolarini xaritalash** (filter yoki servis ichida): `23505` → 409, `23503` → 409. Xom SQL/driver xabarini mijozga chiqarmang (M7 buni tekshiradi).

### Testlar (barcha tekshiruvlar)

M1 dagi barcha e2e testlar (health prefiksi, services CRUD, xato formati) endi **PostgreSQL** bilan yana o'tishi kerak (`test/m1/*.e2e-spec.ts` M2 da ham ishlaydi, faqat unit spec chiqarib tashlangan). Quyida **yangi** testlar:

#### `test/m2/health.db.e2e-spec.ts`
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 1 | `GET /api/v1/health` | 200; `status==='ok'`, `database==='up'`, `timestamp` yaroqli |

#### `test/m2/migrations.int-spec.ts`
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 2 | `up()` | barcha entity jadvallari mavjud; `showMigrations()` → `false` (kutilayotgan migratsiya yo'q) |
| 3 | Drift | `createSchemaBuilder().log()` → `upQueries` **bo'sh** (migratsiyalar entitylarga to'liq mos) |
| 4 | `down()` | barcha migratsiyalar (kamida 1 ta) teskari qaytariladi → hamma entity jadvallari **yo'q** |
| 5 | `down` dan keyin `up` | jadvallar qaytadi, kutilayotgan migratsiya yo'q |

#### `test/m2/schema.int-spec.ts`
**Konfiguratsiya**
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 6 | Ulangan baza | `options.database` `_test` bilan tugaydi |
| 7 | Ro'yxatdan o'tgan entitylar | `User, Service, Staff, Booking` bor |
| 8 | `synchronize` | falsy |
| 9 | Migratsiyalar jadvali | kamida 1 ta yozuv |

**User**
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 10 | Yangi user | `id` uuid, `role==='CUSTOMER'`, `createdAt` — `Date` |
| 11 | `ADMIN`, `STAFF`, `CUSTOMER` | hammasi saqlanadi |
| 12 | `role: 'SUPERHERO'` | DB rad etadi (xato) |
| 13 | Bir xil `email` | `23505` (UNIQUE) |

**Service**
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 14 | `price: 49999.99` | o'qilganda `typeof === 'number'` va `=== 49999.99` |
| 15 | Bir xil `name` | `23505` |
| 16 | `description` | ixtiyoriy (null) |
| 17 | `updatedAt` | `update` dan keyin kattalashadi; `createdAt` o'zgarmaydi |

**Staff**
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 18 | Staff + `user` relation | `user.role==='STAFF'`, `isActive===true` |
| 19 | Bitta user uchun ikkinchi staff | `23505` |

**Booking**
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 20 | Default holat | `status==='PENDING'`, `notes` null, `customer/staff.user/service` relation yuklanadi, `startTime/endTime` — `Date` |
| 21 | 4 ta status | `PENDING, CONFIRMED, CANCELLED, COMPLETED` saqlanadi |
| 22 | Mavjud bo'lmagan `staff` | `23503` (FK) |
| 23 | `endTime <= startTime` (teng va kichik) | `23514` (CHECK) |
| 24 | Vaqt zonasi | UTC instant aynan qaytadi (`2030-06-15T23:30:00.000Z` va `2030-06-16T00:15:00.000Z`) |

**Referential integrity** (booking bor bo'lsa o'chirib bo'lmaydi)
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 25 | `Service` ni o'chirish | `23503` |
| 26 | `Staff` ni o'chirish | `23503` |
| 27 | `User` (mijoz) ni o'chirish | `23503` |

#### `test/m2/services.db.e2e-spec.ts`
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 28 | `POST` | 201, `id` uuid; yozuv DB da bor, `name==='Haircut'` |
| 29 | Ilovani yopib qayta ochish (`reset:false`) | yaratilgan xizmat `GET` bilan topiladi (ma'lumot saqlanadi) |
| 30 | `price: 49999.99` | `POST`, `GET /:id`, `GET /` — hammasida `number` va `49999.99` |
| 31 | `GET /services` tartibi | `A, B, C` (`createdAt` o'sish tartibida) |
| 32 | `PATCH` | `updatedAt` kattalashadi, `createdAt` aynan o'sha |
| 33 | `DELETE` | 204 va yozuv DB dan chindan o'chadi |
| 34 | Bir vaqtda ikkita bir xil nom (`Promise.all`) | statuslar aynan `[201, 409]` (**500 emas!**), DB da 1 ta yozuv |
| 35 | Booking bog'langan xizmatni o'chirish | 409, `statusCode===409`; xizmat DB da qoladi |

### Tuzoqlar / o'ylab ko'ring
- `decimal` Postgres dan **string** qaytadi → `transformer`.
- `timestamptz` ↔ `timestamp`: nega UTC instant saqlanishi muhim?
- "Avval tekshir, keyin yoz" nom takrorida race beradi → unique constraint + xatoni ushlash.
- `TRUNCATE ... CASCADE` testlar orasida ishlatiladi; entity jadval nomlari `ds.entityMetadatas` dan olinadi.

### Qabul mezonlari (M2)
- [ ] `pnpm run test:m2` yashil (M1 e2e + M2).
- [ ] `synchronize` o'chiq; sxema faqat migratsiyadan.
- [ ] `ServicesService` endi `Repository` orqali ishlaydi.

---

## M3. Authentication

**Maqsad:** Passport, JWT, Guard, parolni hashlash, `ConfigService` bilan secret boshqaruvi. (To'liq talablar: `docs/milestones.md` → M3.)

### Nima qilish kerak

1. **Endpointlar:** `POST /auth/register` (201 `{id,email,fullName,role}`), `POST /auth/login` (200 `{accessToken}`), `GET /auth/me` (JWT; 200 `{id,email,fullName,role}`).
2. **RegisterDto:** `email` (trim + lowercase + `IsEmail`), `fullName` (1–100), `password` (8–72). **LoginDto:** `email` (trim + lowercase), `password`.
3. Ro'yxatdan o'tgan user **doim `CUSTOMER`**. `role` / `passwordHash` yuborilsa — 400 (whitelist).
4. Parol **bcrypt** bilan (`BCRYPT_ROUNDS` dan, default 10). Hech qaysi javobda parol/hash yo'q.
5. Noto'g'ri parol va mavjud bo'lmagan email → **bir xil** 401 xabari.
6. JWT payload: `sub` = user id (maxfiy ma'lumot yo'q); secret va muddat `JWT_SECRET`/`JWT_EXPIRES_IN` dan. `JWT_SECRET` yo'q bo'lsa ilova **ishga tushmasin**.
7. `JwtStrategy.validate` foydalanuvchini **DB dan** yuklaydi; topilmasa 401. Algoritmni `HS256` bilan cheklang (`alg:none` rad etilsin).
8. `GET /health` va `GET /services` ochiq qoladi.
9. **Shartnoma:** `src/auth/password.ts` → `hashPassword(plain): Promise<string>`, `verifyPassword(plain, hash): Promise<boolean>`. `JwtService` DI dan `app.get(JwtService, { strict: false })` orqali olinadi va `JWT_SECRET` bilan sozlangan bo'lishi kerak (testlar shu bilan token imzolaydi).
10. Parallel register (bir email) → unique violation (`23505`) ni ushlab **409** (500 emas).
11. `AuthService` controllerdan ajratilgan, `JwtStrategy` alohida provider.

### Testlar (barcha tekshiruvlar)

#### `test/m3/password.spec.ts` (unit)
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 1 | `hashPassword('Passw0rd!123')` | oddiy paroldan farq qiladi; `^\$2[aby]\$` formatida |
| 2 | Bir xil parolni ikki marta hashlash | ikki hash **har xil** (salt) |
| 3 | `verifyPassword` to'g'ri parol | `true` |
| 4 | `verifyPassword` noto'g'ri (`passw0rd!123`, `''`) | `false` |

#### `test/m3/auth.e2e-spec.ts` — POST /auth/register
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 5 | To'g'ri ma'lumot | 201; `email, fullName, role==='CUSTOMER'`; `id` uuid; javobda `password` so'zi **yo'q** |
| 6 | DB dagi `passwordHash` | ochiq paroldan farq qiladi, `$2a/$2b/$2y$` bilan boshlanadi |
| 7 | `'  ALI@Test.COM '` | 201; `email === 'ali@test.com'` |
| 8 | Takroriy email (`ALI@test.com`) | 409, `statusCode===409` |
| 9 | 72 belgili parol | 201 |
| 10–20 | **Validatsiya (11 ta):** email noto'g'ri / yo'q; `fullName` yo'q / bo'sh / 101 belgi; `password` yo'q / 7 belgi / 73 belgi / son (`12345678`); `role: 'ADMIN'` yuborildi; `passwordHash` yuborildi | har biri 400 |

#### POST /auth/login
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 21 | To'g'ri login | 200; `accessToken` 3 qismli; payload `sub === user.id`, `exp` — son; payload da `password`/`hash` yo'q |
| 22 | `ALI@TEST.COM` | 200 (katta-kichik harfga sezgir emas) |
| 23 | Noto'g'ri parol | 401 |
| 24 | Mavjud bo'lmagan email | 401; `message` noto'g'ri parol xabari bilan **aynan bir xil** |
| 25–27 | Validatsiya: email yo'q / parol yo'q / email formati noto'g'ri (`abc`) | 400 |

#### GET /auth/me
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 28 | To'g'ri token | 200; `id, email, fullName, role==='CUSTOMER'`; `password` yo'q |
| 29 | Token yo'q | 401 |
| 30 | `Bearer abc.def.ghi` | 401 |
| 31 | `Basic <token>` sxemasi | 401 |
| 32 | Muddati o'tgan token (`expiresIn: -60`) | 401 |
| 33 | Boshqa secret bilan imzolangan | 401 |
| 34 | Imzosi o'zgartirilgan | 401 |
| 35 | `alg: none` | 401 |
| 36 | User DB dan o'chirilgan, eski token | 401 |

#### Ochiq route'lar
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 37 | `GET /health` va `GET /services` tokensiz | 200 |

### Edge case savollari
- bcrypt 72 baytdan keyingi qismni nega kesadi? (`maxLength: 72` — belgi, bayt emas: ko'p baytli unicode haqida o'ylang.)
- Nega `bcrypt.compare` (vaqt bo'yicha hujumga qarshi) ishlatamiz? Mavjud bo'lmagan email uchun ham soxta `compare` qilish mumkin.
- Guard qachon 401, qachon 403?

### Qabul mezonlari (M3)
- [ ] `pnpm run test:m3` yashil (M1–M3).
- [ ] `JWT_SECRET` kodda qattiq yozilmagan; yo'q bo'lsa ilova ishga tushmaydi.

---

## M4. Booking biznes logikasi

**Maqsad:** servis qatlamidagi murakkab qoidalar, tranzaksiya, race condition, state machine. (Qoidalar: `docs/milestones.md` → M4.)

### Nima qilish kerak

1. **Sof funksiyalar** — `src/bookings/booking.rules.ts` (NestJS/DB ga bog'liq emas):
   - `calculateEndTime(startTime: Date, durationMinutes: number): Date` — **kirishni o'zgartirmaydi** (yangi `Date` qaytaradi);
   - `canTransition(from: string, to: string): boolean` — noma'lum status bo'lsa **xato tashlamasdan** `false`;
   - `intervalsOverlap(aStart, aEnd, bStart, bEnd): boolean` — yarim ochiq `[start, end)`.
2. **Endpointlar** (hammasi JWT talab qiladi): `POST /bookings`, `GET /bookings` (`?status=`), `GET /bookings/:id`, `PATCH /bookings/:id` (`{startTime?, notes?}`), `PATCH /bookings/:id/status` (`{status}`).
3. **Javob shakli (tekis):** `{ id, status, startTime, endTime, notes, customerId, staffId, serviceId, createdAt, updatedAt }`. Email/parol/ichki user obyekti yo'q. Vaqtlar ISO (`...Z`) satr.
4. **CreateBookingDto:** `serviceId` (uuid), `staffId` (uuid), `startTime` (qat'iy ISO 8601), `notes?` (≤ 500). `status`, `endTime` yuborilsa — 400.
5. **Qoidalar:**
   - `endTime = startTime + service.durationMinutes` (server hisoblaydi);
   - `startTime` o'tmishda → 400;
   - service/staff topilmasa → 404; `staff.isActive=false` → 400;
   - **overlap:** shu staffda `PENDING`/`CONFIRMED` bronlar bilan `[start,end)` kesishsa → 409; yonma-yon (`end == start`) ruxsat; `CANCELLED`/`COMPLETED` band hisoblanmaydi;
   - **race condition:** bir vaqtda ikki xil so'rov bir slotga → faqat bittasi 201, qolgani 409 (500 emas). Yechim: **tranzaksiya + staff qatoriga pessimistic lock** (`SELECT ... FOR UPDATE`) yoki Postgres exclusion constraint. Yaratish va ko'chirish **bitta tranzaksiyada**;
   - **ko'rinish:** CUSTOMER — o'zinikini, STAFF — o'ziga biriktirilganlarni, ADMIN — hammasini. Ko'ra olmagan bron uchun **404**. Ro'yxat `startTime` o'sish tartibida;
   - **state machine:** `PENDING → CONFIRMED | CANCELLED`, `CONFIRMED → COMPLETED | CANCELLED`; `CANCELLED`/`COMPLETED` yakuniy; noto'g'ri yoki **bir xil statusga** o'tish → **409**; noma'lum status qiymati → **400** (DTO da `IsEnum`);
   - **kim nima qiladi:** CUSTOMER faqat **o'z** bronini `CANCELLED` qila oladi (boshqa status → **403**; boshqaning broni → **404**); biriktirilgan STAFF va ADMIN har qanday to'g'ri o'tishni;
   - `COMPLETED` ga faqat `startTime` o'tgan bronlar o'tadi (aks holda 409);
   - **PATCH** (ko'chirish): faqat `PENDING` (aks holda 409); overlap tekshiruvi **o'zini hisobga olmaydi**; o'tmishga ko'chirish 400; `status/staffId/serviceId/endTime` yuborilsa 400; `endTime` qayta hisoblanadi;
   - bekor qilingach slot bo'shaydi.
6. Rol bo'yicha qaror **servis qatlamida** (controllerda `if (role === ...)` emas).

### Testlar (barcha tekshiruvlar)

#### `test/m4/booking.rules.spec.ts` (unit)
**calculateEndTime**
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 1 | `10:00` + 45 min | `10:45:00.000Z` |
| 2 | `23:30` + 60 min | ertasi kun `00:30` |
| 3 | Kirish `Date` o'zgarmaydi | mutatsiya yo'q |
| 4 | `2030-12-31T23:59` + 2 min | `2031-01-01T00:01` |

**canTransition**
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 5–8 | `PENDING→CONFIRMED`, `PENDING→CANCELLED`, `CONFIRMED→COMPLETED`, `CONFIRMED→CANCELLED` | `true` |
| 9–20 | **Qolgan barcha 12 juftlik** (4×4 = 16 dan ruxsat etilgan 4 tasidan boshqasi): `PENDING→PENDING`, `PENDING→COMPLETED`, `CONFIRMED→PENDING`, `CONFIRMED→CONFIRMED`, `CANCELLED→*` (4 ta), `COMPLETED→*` (4 ta) | `false` |
| 21 | `('PENDING','FOO')`, `('FOO','PENDING')` | `false` (xato tashlamaydi) |

**intervalsOverlap** (baza `10:00–11:00`, har safar simmetriya ham tekshiriladi)
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 22 | `09:30–10:30` (chapdan qisman) | `true` |
| 23 | `10:30–11:30` (o'ngdan qisman) | `true` |
| 24 | `10:15–10:45` (to'liq ichida) | `true` |
| 25 | `09:00–12:00` (to'liq o'rab oladi) | `true` |
| 26 | `10:00–11:00` (aynan bir xil) | `true` |
| 27 | `09:00–10:00` (oldin, yonma-yon) | `false` |
| 28 | `11:00–12:00` (keyin, yonma-yon) | `false` |
| 29 | `07:00–08:00` (ancha oldin) | `false` |
| 30 | `15:00–16:00` (ancha keyin) | `false` |

#### `test/m4/bookings.e2e-spec.ts` — POST /bookings
(Testlar uchun: 2 mijoz, 1 admin, 2 staff (A, B), `Haircut` 30 min, `Coloring` 120 min.)
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 31 | To'g'ri so'rov | 201; `status==='PENDING'`, `startTime===at(0)`, `endTime===at(30)`, `customerId`=men, `staffId`, `serviceId`; `id` uuid |
| 32 | 120 daqiqalik xizmat | `endTime === at(120)` |
| 33 | `notes` | saqlanadi |
| 34 | Javob matni | `password` yoki `email` so'zi **yo'q** |
| 35 | Token yo'q | 401 |
| 36–43 | **Validatsiya (8 ta):** `startTime` yo'q; `startTime` ISO emas (`'tomorrow 10am'`); `serviceId` uuid emas; `staffId` uuid emas; `serviceId` yo'q; `status` yuborildi; `endTime` yuborildi; `notes` 501 belgi | har biri 400 |
| 44 | O'tmishdagi vaqt (`ago(60)`) | 400 |
| 45 | Mavjud bo'lmagan service | 404 |
| 46 | Mavjud bo'lmagan staff | 404 |
| 47 | `isActive=false` staff | 400 |

#### Staff band bo'lishi (overlap) — staff A da `at(0)..at(30)` PENDING bron bor
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 48 | Boshlanishi `-15` (boshida kesishadi) | 409, `statusCode===409` |
| 49 | `+15` (ichidan boshlanadi) | 409 |
| 50 | `0` (aynan bir xil) | 409 |
| 51 | `+29` (oxirgi daqiqa) | 409 |
| 52 | 120 daqiqalik xizmat `at(-30)` da (mavjudni to'liq o'raydi) | 409 |
| 53 | `+30` (yonma-yon keyin) | 201 |
| 54 | `-30` (yonma-yon oldin) | 201 |
| 55 | `+120` (ancha keyin) | 201 |
| 56 | Boshqa staff (B), shu vaqt | 201 |
| 57 | Mavjud bron `CONFIRMED` | yangi bron → 409 |
| 58 | Mavjud bron `CANCELLED` | yangi bron → 201 |
| 59 | Ikki mijoz bir vaqtda bir xil slotga (`Promise.all`, `at(300)`) | statuslar `[201, 409]`; DB da PENDING/CONFIRMED bronlar soni = 1 |

#### GET /bookings (ko'rinish doirasi) — 3 ta bron: (mijoz1, staffA, 0), (mijoz2, staffB, 60), (mijoz1, staffA, 120, CANCELLED)
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 60 | Mijoz1 | 2 ta, hammasi `customerId===mijoz1` |
| 61 | Staff B | 1 ta, `staffId===staffB` |
| 62 | Admin | 3 ta |
| 63 | Tartib | `startTime` o'sish tartibida |
| 64 | `?status=CANCELLED` | 1 ta, `status==='CANCELLED'` |
| 65 | `?status=FOO` | 400 |
| 66 | Token yo'q | 401 |

#### GET /bookings/:id
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 67 | Egasi, biriktirilgan staff, admin | hammasi 200, `id` mos |
| 68 | Boshqa mijoz va boshqa staff | 404 (mavjudligi sir) |
| 69 | `xyz` → 400; mavjud bo'lmagan uuid → 404 | |

#### PATCH /bookings/:id/status
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 70 | Mijoz o'z `PENDING` bronini `CANCELLED` | 200 |
| 71 | Mijoz o'z `CONFIRMED` bronini `CANCELLED` | 200 |
| 72 | Mijoz `CONFIRMED` qilmoqchi | **403** |
| 73 | Boshqa mijoz | **404** |
| 74 | Biriktirilgan staff `CONFIRMED` | 200 |
| 75 | Boshqa staff | 404 |
| 76 | Admin: `CONFIRMED` keyin `CANCELLED` | ikkalasi 200 |
| 77 | O'tgan `CONFIRMED` bronni staff `COMPLETED` | 200 |
| 78 | Hali boshlanmagan `CONFIRMED` → `COMPLETED` | 409 |
| 79–85 | **Taqiqlangan o'tishlar (7 ta, admin, bron o'tmishda):** `PENDING→COMPLETED`, `CANCELLED→CONFIRMED`, `CANCELLED→PENDING`, `COMPLETED→CANCELLED`, `COMPLETED→CONFIRMED`, `CONFIRMED→PENDING`, `PENDING→PENDING` | har biri 409, `statusCode===409` |
| 86 | `status: 'FOO'` | 400 |
| 87 | Bekor qilingach slot bo'shaydi | 1-bron 201; 2-mijoz shu slotga 409; 1-bron `CANCELLED`; 2-mijoz endi 201 |

#### PATCH /bookings/:id (ko'chirish)
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 88 | Egasi `PENDING` ni `at(120)` ga ko'chiradi | 200; `startTime===at(120)`, `endTime===at(150)` |
| 89 | O'zining eski slotiga qisman kesishgan holda (`at(10)`) | 200 (o'zi bilan to'qnashmaydi) |
| 90 | Boshqa bron bilan to'qnashsa | 409 |
| 91 | O'tmishga ko'chirish | 400 |
| 92 | `CONFIRMED` yoki `CANCELLED` ni ko'chirish | 409 |
| 93 | Boshqa mijoz | 404 |
| 94 | Faqat `notes` | 200; `notes` yangilanadi, `startTime` o'zgarmaydi |
| 95 | `status` / `staffId` yuborilsa | 400 |

### Qabul mezonlari (M4)
- [ ] `pnpm run test:m4` yashil.
- [ ] `booking.rules.ts` NestJS/DB dan mustaqil.
- [ ] Yaratish va ko'chirish bitta tranzaksiyada.

---

## M5. RBAC va Request processing

**Maqsad:** `Reflector`, custom decorator, `RolesGuard`, middleware, interceptor, custom pipe, filter. (Jadval: `docs/milestones.md` → M5.)

### Nima qilish kerak

1. **Shartnomalar:**
   - `src/auth/decorators/roles.decorator.ts` → `@Roles(...roles: string[])` (metadata o'rnatadi; method va class darajasida ishlaydi);
   - `src/auth/guards/roles.guard.ts` → `RolesGuard(reflector: Reflector)`, `canActivate(ctx)`: `@Roles` yo'q → `true`; `request.user.role` ro'yxatda → `true`, aks holda `false`; **method darajasi class darajasini override qiladi** (`getAllAndOverride`); `request.user` yo'q → `false`;
   - `@CurrentUser()` param decorator.
2. **Endpointlar:**

   | Method | Path | Kim | Natija |
   |---|---|---|---|
   | POST/PATCH/DELETE | `/services…` | ADMIN | 201 / 200 / 204 (GET ochiq) |
   | GET | `/users` | ADMIN | 200 `[{id,email,fullName,role,createdAt}]` |
   | PATCH | `/users/:id/role` | ADMIN | `{role}` → 200; admin **o'z rolini pasaytirsa 409** |
   | POST | `/staff` | ADMIN | `{userId, specialization?}` → 201 `{id,userId,specialization,isActive}`; user roli `STAFF` bo'ladi; user yo'q 404; allaqachon staff 409 |
   | GET | `/staff` | har qanday JWT | `[{id,userId,fullName,specialization,isActive}]` (email yo'q) |
   | PATCH | `/staff/:id` | ADMIN | `{isActive?, specialization?}` |
   | POST | `/bookings` | CUSTOMER, ADMIN | ADMIN `customerId` ni **majburiy** beradi (yo'q → 400, noma'lum → 404); CUSTOMER `customerId` yuborsa **403**; STAFF → 403 |
   | GET | `/bookings` | JWT | yangi `?from=&to=` (`startTime` bo'yicha `[from, to)`) |

   > `CreateBookingDto` da `customerId` ixtiyoriy (`IsUUID`) maydon sifatida e'lon qilinishi kerak, aks holda whitelist 400 beradi, test esa 403 kutadi.
3. **Guard tartibi:** 401 → 403 → validatsiya (400) → 404. Mijoz noto'g'ri body yoki mavjud bo'lmagan id bilan ham **403** oladi.
4. **Rol har so'rovda DB dan** (`JwtStrategy.validate`). Admin rolni o'zgartirsa, **eski token** yangi huquqlarni darhol oladi.
5. **Request-ID middleware:** har javobda `x-request-id` (uuid). Mijoz yaroqli uuid yuborsa shu qaytariladi; yaroqsiz bo'lsa **yangi uuid** (yuborilgan qiymat aks ettirilmaydi). 404 javobda ham ishlashi shart (global middleware, hamma route uchun).
6. **Response-time interceptor:** muvaffaqiyatli javobda `x-response-time: <son>ms`.
7. **Exception filter:** barcha xato javoblarda `requestId` (header bilan bir xil).
8. **Custom pipe** (`ParseIsoDatePipe` kabi): `from`/`to` ISO bo'lmasa 400; `from > to` → 400.
9. Controllerlarda qo'lda `if (role !== ...) throw` **yo'q**; faqat decorator + guard.
10. M1/M2 testlari `adminHeaders` orqali ishlaydi, shuning uchun `/services` yozish endpointlari ADMIN talab qilganda ham ular yashil qoladi.

### Testlar (barcha tekshiruvlar)

#### `test/m5/roles.guard.spec.ts` (unit)
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 1 | `@Roles` yo'q | `true` |
| 2 | `@Roles('ADMIN')`, ADMIN | `true` |
| 3–4 | `@Roles('ADMIN')`, CUSTOMER va STAFF | `false` |
| 5 | `@Roles('STAFF','ADMIN')`: STAFF, ADMIN → `true`; CUSTOMER → `false` | |
| 6 | Class darajasidagi `@Roles('ADMIN')` metodga tarqaladi (ADMIN `true`, CUSTOMER `false`) | |
| 7 | Method darajasi class ni override qiladi (`@Roles('CUSTOMER')`: CUSTOMER `true`, ADMIN `false`) | |
| 8 | `request.user` yo'q | `false` |

#### `test/m5/request-processing.e2e-spec.ts`
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 9 | `GET /health` | `x-request-id` uuid formatida |
| 10 | Ikki so'rov | id lar **har xil** |
| 11 | Mijoz to'g'ri uuid yuboradi | aynan o'sha qaytadi |
| 12 | `x-request-id: 'not-a-uuid <script>'` | yangi uuid qaytadi (yuborilgani emas) |
| 13 | 404 javobda | `x-request-id` bor |
| 14–17 | Xato javobi `requestId` = header `x-request-id` (uuid): **404**, **400** (`/auth/login` bo'sh body), **401** (`/auth/me` tokensiz), **403** (customer `POST /services`) | |
| 18 | `GET /health` | `x-response-time` ~ `^\d+(\.\d+)?ms$` |
| 19 | `GET /auth/me` (JWT bilan) | `x-response-time` bor |

#### `test/m5/rbac.e2e-spec.ts` — Services
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 20–23 | `GET /services` (anonim, customer, staff, admin) | hammasi 200 |
| 24–27 | `POST /services` | anonim 401, customer 403, staff 403, admin 201 |
| 28–31 | `PATCH /services/:id` | 401, 403, 403, 200 |
| 32–35 | `DELETE /services/:id` | 401, 403, 403, 204 |
| 36 | Customer mavjud bo'lmagan id ga `PATCH` | **403** (404 emas) |
| 37 | Customer noto'g'ri body (`{}`) bilan `POST` | **403** (400 emas) |
| 38 | Admin: `{name:''}` → 400; to'g'ri → 201; takroriy nom → 409 | |

#### Users
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 39–42 | `GET /users` | anonim 401, customer 403, staff 403, admin 200 |
| 43 | `GET /users` tarkibi | 3 ta user; `id, email, role` bor; `password` yo'q |
| 44 | Admin `PATCH /users/:id/role {role:'ADMIN'}` | 200; `role==='ADMIN'` |
| 45 | Rol o'zgargach **eski token** | oldin `GET /users` 403, o'zgargach 200 |
| 46–48 | `PATCH /users/:id/role` | anonim 401, customer 403, staff 403 |
| 49 | `role:'ROOT'` → 400; mavjud bo'lmagan user → 404; `abc` uuid → 400 | |
| 50 | Admin o'z rolini `CUSTOMER` ga tushirishi | 409 |

#### Staff boshqaruvi
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 51–53 | `POST /staff` | anonim 401, customer 403, staff 403 |
| 54 | Admin customer ni staff qiladi | 201; `userId`, `specialization:'Barber'`, `isActive:true`; `id` uuid; eski token bilan `/auth/me` → `role==='STAFF'` |
| 55 | Mavjud bo'lmagan user 404; `userId:'abc'` 400; allaqachon staff 409 | |
| 56 | `GET /staff` | tokensiz 401; customer 200: 1 ta, `id, userId, isActive`, `fullName` string; `password`/`email` yo'q |
| 57 | `PATCH /staff/:id` | customer 403, staff 403; admin 200 (`isActive:false`, `specialization:'Colorist'`) |
| 58 | Nofaol qilingan staff ga bron | 400 |

#### Bookings: rol qoidalari
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 59 | Admin `customerId` bilan | 201, `customerId` mos |
| 60 | Admin `customerId` siz → 400; noma'lum `customerId` → 404 | |
| 61 | Customer `customerId` yuboradi (boshqaniki ham, o'ziniki ham) | 403 |
| 62 | Staff bron yaratmoqchi | 403 |
| 63 | `?from=at(50)&to=at(130)` (bronlar 0, 60, 120 da) | `[at(60), at(120)]` |
| 64 | `?to=at(120)` | 2 ta (`to` kiritilmaydi — yarim ochiq) |
| 65 | Faqat `?from=at(60)` | 2 ta |
| 66–67 | `from=yesterday` yoki `to=123abc` | 400 |
| 68 | `from > to` | 400 |

### Savollar
- `forRoutes('*')` global prefix bilan qanday ishlaydi? 404 route'larda ishlaydimi?
- Interceptor xato javoblarida nega ishlamaydi? Qaysi qatlam ishlaydi?
- `APP_GUARD` + `@Public()` yondashuvi qachon yaxshiroq?
- `RolesGuard` ni `JwtAuthGuard` dan oldin qo'ysangiz nima bo'ladi?

### Qabul mezonlari (M5)
- [ ] `pnpm run test:m5` yashil (M1–M5).
- [ ] Controllerlarda qo'lda rol tekshiruvi yo'q.

---

## M6. Fayl yuklash

**Maqsad:** `FileInterceptor`, Multer, magic-bytes validatsiya, storage servisi (custom provider), statik fayl berish, yetim fayllarni boshqarish.

### Nima qilish kerak

1. **Shartnoma:** `src/uploads/image-type.ts` → `detectImageType(buffer: Buffer): 'png' | 'jpeg' | 'webp' | null`. Faqat **dastlabki baytlarga** qaraydi; qisqa/bo'sh buffer uchun xato tashlamaydi.
   - PNG: `89 50 4E 47 0D 0A 1A 0A`; JPEG: `FF D8 FF`; WEBP: `RIFF` (0–3) + `WEBP` (8–11).
2. **Endpointlar:**
   - `POST /users/me/avatar` (JWT; multipart, field **`file`**) → 201 `{ avatarUrl }`;
   - `DELETE /users/me/avatar` (JWT) → 204 (avatar bo'lmasa ham 204);
   - `POST /services/:id/image` (ADMIN; field `file`) → 201 `{ imageUrl }`;
   - yuklangan faylga `GET <avatarUrl|imageUrl>` — ochiq, to'g'ri `Content-Type` bilan. URL `/` bilan boshlanadi (masalan `/uploads/<uuid>.png`; global prefix `api/v1` dan **tashqarida** bo'lishi mumkin — shu yo'l bilan statik serve qiling).
3. **Entitylar** (**migratsiya bilan!**): `User.avatarUrl?`, `Service.imageUrl?` (+ diskdagi fayl nomi/yo'li uchun kerakli maydon). `GET /auth/me` va `GET /services/:id` javobida `avatarUrl` / `imageUrl` (yo'q bo'lsa `null`). Migratsiya drift testi (M2) hamon yashil bo'lishi kerak.
4. **Qoidalar:**
   - turlar: PNG, JPEG, WEBP — **magic bytes** bo'yicha; `Content-Type` va kengaytmaga ishonilmaydi; SVG va matn → 400;
   - hajm: ko'pi bilan **2 MB** (aynan 2 MB ruxsat); oshsa **413** (xato javobi `statusCode: 413`);
   - fayl yo'q, noto'g'ri field nomi, bir nechta fayl, bo'sh fayl → 400;
   - saqlangan nom `uuid` + kengaytma (**aniqlangan turdan**: `.png`, `.jpg`/`.jpeg`, `.webp`); asl nom (`../` ham) ishlatilmaydi; fayl faqat `UPLOAD_DIR` ichida;
   - rad etilgan yuklashdan keyin diskda **hech narsa qolmasin**;
   - qayta yuklash eski faylni o'chiradi; xizmat o'chirilsa rasmi ham o'chadi;
   - `UPLOAD_DIR` yo'q bo'lsa servis o'zi yaratadi (`mkdir -p`); `UPLOAD_DIR` env dan, kodda qattiq yo'l yo'q;
   - `StorageService` — controllerdan ajratilgan custom provider.
5. **Amaliy maslahat:** `memoryStorage` + `limits: { fileSize: 2 MB, files: 1 }` ishlating, magic bytes ni tekshirgach **keyin** diskka yozing — shunda rad etilganda diskda hech narsa qolmaydi. DB yangilash muvaffaqiyatsiz bo'lsa yangi faylni o'chiring; yangi saqlangach eskisini o'chiring. Xizmat o'chirilganda faylni DB o'chirishi **muvaffaqiyatli bo'lgandan keyin** o'chiring (409 bo'lsa rasm qolsin).

### Testlar (barcha tekshiruvlar)

#### `test/m6/image-type.spec.ts` (unit)
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 1 | PNG buffer | `'png'` |
| 2 | JPEG buffer | `'jpeg'` |
| 3 | WEBP buffer | `'webp'` |
| 4 | Oddiy matn | `null` |
| 5 | Bo'sh buffer | `null` |
| 6 | Juda qisqa buffer (`[0x89,0x50]`, `[0xff]`) | `null` (xatosiz) |
| 7 | `RIFF` bor, lekin `WAVE` | `null` |
| 8 | PNG baytlari boshida emas (oldida `xx`) | `null` |

#### `test/m6/uploads.e2e-spec.ts` — POST /users/me/avatar
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 9 | Tokensiz | 401; diskda fayl yo'q |
| 10 | Boshlang'ich `/auth/me` | `avatarUrl` null |
| 11–13 | PNG, JPEG, WEBP yuklash | 201; `avatarUrl` `^/.+(.png|.jpg|.jpeg|.webp)$`; `/auth/me.avatarUrl` mos; diskda 1 fayl; URL bo'yicha `GET` → 200, `Content-Type` mos (`image/png` va h.k.), baytlar **bir xil** |
| 14 | Fayl nomi `my secret photo.exe` | URL da `secret`/`photo` yo'q; `.png` bilan tugaydi |
| 15 | Path traversal (`../../evil.png`) | 201; URL da `evil` / `..` yo'q; diskda 1 fayl; `uploadDir/../../evil.png` **mavjud emas** |
| 16 | Matn fayli (`text/plain`) | 400; diskda hech narsa; `avatarUrl` null |
| 17 | Matn, lekin `image/png` deb yuborilgan | 400 (soxta Content-Type), diskda hech narsa |
| 18 | SVG | 400, diskda hech narsa |
| 19 | Bo'sh fayl | 400, diskda hech narsa |
| 20 | Aynan **2 MB** | 201 |
| 21 | **2 MB + 1 bayt** | **413**; `statusCode===413`; diskda hech narsa |
| 22 | Fayl yuborilmasa | 400 |
| 23 | Field nomi `avatar` | 400 |
| 24 | Ikki fayl | 400; diskda hech narsa |
| 25 | Qayta yuklash (PNG → JPEG) | URL o'zgaradi; diskda 1 fayl; eski URL → 404; yangisi → 200 |
| 26 | Boshqa foydalanuvchi | uning `avatarUrl` null qoladi |

#### DELETE /users/me/avatar
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 27 | Yuklangan avatarni o'chirish | 204; diskda yo'q; `avatarUrl` null; eski URL → 404 |
| 28 | Avatar yo'q | 204 (idempotent) |
| 29 | Tokensiz | 401 |

#### POST /services/:id/image
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 30 | Anonim | 401; diskda hech narsa |
| 31 | Customer | 403; diskda hech narsa |
| 32 | Admin yuklaydi | 201 `{imageUrl}` (`^/.+\.png$`); `GET /services/:id.imageUrl` mos; URL → 200 |
| 33 | Rasm yuklanmagan xizmat | `imageUrl` null |
| 34 | Mavjud bo'lmagan xizmat | 404; diskda hech narsa |
| 35 | `abc` uuid | 400 |
| 36 | Noto'g'ri tur (matn, `x.png`) | 400; diskda hech narsa |
| 37 | Qayta yuklash (PNG → WEBP) | diskda 1 fayl |
| 38 | Xizmat o'chirilsa (`DELETE`, admin, 204) | rasm fayli ham o'chadi |

### Savollar
- `FileTypeValidator` faqat `mimetype` ga qaraydi — soxta `Content-Type` ni qanday ushlaysiz?
- Multer: `memoryStorage` yoki disk? 2 MB uchun qaysi biri xavfsizroq, katta fayllarda-chi?
- Guard → interceptor → pipe tartibi: nega `401/403` da fayl umuman yozilmaydi?
- Statik berishda global prefix bilan nima qilish kerak? Nega URL `/uploads/...` bo'lishi mumkin?

### Qabul mezonlari (M6)
- [ ] `pnpm run test:m6` yashil (M1–M6).
- [ ] `UPLOAD_DIR` env dan; kodda qattiq yo'l yo'q.

---

## M7. Yakuniy integratsiya

**Maqsad:** hamma narsani birlashtirish, xavfsizlik va barqarorlikni tekshirish. **Yangi endpoint yo'q.**

### Nima qilish kerak (testlardan tashqari)

- Xato filtri **hamma** xatoni `{ statusCode, message, path, timestamp, requestId }` ga o'raydi, jumladan HTTP-bo'lmagan xatolar:
  - body-parser xatolari: juda katta body → **413** (xatoning `status`/`statusCode` ni saqlang, aks holda 500 chiqadi), noto'g'ri JSON → 400;
  - Multer xatolari (413/400), TypeORM `QueryFailedError` (409), kutilmagan xato → 500 **umumiy xabar bilan** (stack/SQL yo'q).
- 409 xabarlarida `stack`, `SELECT`, `INSERT`, `duplicate key`, `constraint`, `QueryFailedError` so'zlari **bo'lmasin** (test regex bilan qidiradi).
- Body limit: default Express (100 kb) ni qoldiring yoki aniq belgilang; 200 KB li login body → 413.
- Bo'sh bazada `migration:run` noldan ishlaydi; `migration:revert` ham.
- `.env.example` bor; `.env`/`.env.test` repoda yo'q.
- README: ishga tushirish, env, migratsiya, testlar.

### Testlar (barcha tekshiruvlar)

#### `test/m7/journey.e2e-spec.ts` — foydalanuvchi sayohati (13 qadam, ketma-ket, bitta ilova)
| # | Qadam | Kutilgan |
|---|---|---|
| 1 | ADMIN `Haircut` (45 min, `59000.5`) yaratadi | 201; `price === 59000.5` |
| 2 | Oddiy user ro'yxatdan o'tadi, ADMIN uni STAFF qiladi | `POST /staff` 201; user eski tokeni bilan `/auth/me` → `role==='STAFF'` |
| 3 | Mijoz `Customer@Test.com` ro'yxatdan o'tadi, login qiladi | `email` kichik harfga o'tgan; `GET /services` da xizmat bor; `GET /staff` da staff bor |
| 4 | Mijoz bron qiladi (`notes`) | 201; `PENDING`, `endTime === at(45)`, `customerId` mos |
| 5 | Boshqa mijoz `at(15)` ga (kesishadi) | 409 |
| 6 | STAFF o'z bronlarini ko'radi (faqat shu 1 ta) va tasdiqlaydi | ro'yxat `[bookingId]`; status → 200 `CONFIRMED` |
| 7 | Mijoz tasdiqlangan bronni bekor qiladi; slot bo'shaydi; qayta bron | status 200; yangi bron 201 |
| 8 | Bekor qilingan bronni admin `CONFIRMED` qilmoqchi | 409 |
| 9 | ADMIN barcha bronlarni va filtrni ko'radi | jami 2 ta; `?status=CANCELLED` → faqat birinchi bron |
| 10 | Bron bog'langan xizmatni ADMIN o'chirmoqchi | 409 |
| 11 | O'tmishdagi `CONFIRMED` bron STAFF tomonidan `COMPLETED` | 200 `COMPLETED` |
| 12 | Mijoz avatar, ADMIN xizmat rasmi yuklaydi | ikkalasi 201; `/auth/me.avatarUrl` va `/services/:id.imageUrl` mos; diskda 2 fayl |
| 13 | ADMIN staff ni nofaol qiladi | yangi bron 400; mavjud (2-) bron `PENDING` holatida saqlanadi |

#### `test/m7/security.e2e-spec.ts` — Rol matritsasi (10 endpoint × 4 rol = **40** tekshiruv)
Ustunlar: anonim / customer / staff / admin. (admin ustunida 400/404 — "ma'lumot yetishmaydi", lekin **hech qachon 401/403 emas**.)

| # | Endpoint (so'rov) | anonim | customer | staff | admin |
|---|---|---|---|---|---|
| 1 | `GET /auth/me` | 401 | 200 | 200 | 200 |
| 2 | `GET /services` | 200 | 200 | 200 | 200 |
| 3 | `POST /services` (to'g'ri body) | 401 | 403 | 403 | 201 |
| 4 | `GET /users` | 401 | 403 | 403 | 200 |
| 5 | `PATCH /users/:id/role` (`role:'NOPE'`) | 401 | 403 | 403 | 400 |
| 6 | `GET /staff` | 401 | 200 | 200 | 200 |
| 7 | `POST /staff` (`userId`: mavjud emas) | 401 | 403 | 403 | 404 |
| 8 | `GET /bookings` | 401 | 200 | 200 | 200 |
| 9 | `POST /bookings` (`customerId` siz) | 401 | 201 | 403 | 400 |
| 10 | `POST /users/me/avatar` (fayl yo'q) | 401 | 400 | 400 | 400 |

#### Maxfiy ma'lumot sizib chiqmasligi
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 41 | `register`, `login`, `GET /auth/me`, `/users`, `/staff`, `/bookings`, `/services` javoblari birlashtirib tekshiriladi | `passwordHash` so'zi, bcrypt hash (`$2a/$2b/$2y$`) va ochiq parol (`Passw0rd!123`) **yo'q** |

#### Yagona xato formati
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 42 | 400 (`/auth/login` bo'sh body) | `{statusCode:400, message, path (api/v1 ni o'z ichiga oladi), timestamp (yaroqli), requestId}` |
| 43 | 401 (`/auth/me` tokensiz) | shu format, `statusCode:401` |
| 44 | 403 (customer `POST /services`) | shu format, `statusCode:403` |
| 45 | 404 (`/services/<noma'lum uuid>`) | shu format, `statusCode:404` |
| 46 | 409 (takroriy xizmat nomi) | `statusCode:409`, `path==='/api/v1/services'`, `requestId` bor |
| 47 | 409 javob matni | `stack`, `SELECT`, `INSERT`, `duplicate key`, `constraint`, `QueryFailedError` **yo'q** |

#### Zararli / g'alati kirishlar
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 48 | `GET /bookings?status=CONFIRMED' OR '1'='1` (admin) va `GET /services/1' OR '1'='1` | ikkalasi 400 |
| 49 | Nom `Robert'); DROP TABLE services;--` bilan xizmat yaratish | 201; nom aynan shunday saqlanadi; `GET /services` da bor; jadval buzilmagan |
| 50 | `login` ga 200 KB li body | 413 |
| 51 | `fullName: "Oʻtkir Ŝaŭk 🙂"` bilan register | 201; ism aynan shunday qaytadi |
| 52 | Mass-assignment: `PATCH /users/:id/role` ga `{role:'STAFF', email:'hacker@test.com'}` | 400 |

#### Bir vaqtdagi (concurrent) bronlar
| # | Tekshiruv | Kutilgan |
|---|---|---|
| 53 | 6 ta parallel `POST /bookings` bir xil slotga (`at(9000)`) | aynan **1 ta 201**, **5 ta 409**, **hech qaysi 5xx** |

### Yakuniy checklist (testdan tashqari)
- [ ] `pnpm run test:m7` to'liq yashil (M1–M7).
- [ ] `pnpm run build` xatosiz. `pnpm run lint` toza.
- [ ] Bo'sh bazada `migration:run` noldan ishlaydi. `migration:revert` ham.
- [ ] `.env.example` bor, `.env` / `.env.test` repoda yo'q.
- [ ] README: ishga tushirish, env, migratsiya, testlar.

---

## 3. Eng ko'p uchraydigan xatolar (qisqacha)

| Alomat | Ehtimoliy sabab |
|---|---|
| Testlar `configureApp` topolmaydi | `app.setup.ts` da funksiya hali `appSetup` deb nomlangan |
| Hamma M2+ testlar darhol to'xtaydi (`[TEST GUARD]`) | `.env.test` da `DB_NAME` `_test` bilan tugamaydi yoki `NODE_ENV` ≠ `test` |
| `global-setup` da "relation ... already exists" / jadval yo'q | Migratsiya `down` to'liq emas yoki entity yo'llari glob'da topilmayapti |
| Drift testi qizil | Entity va migratsiya mos emas (`DEFAULT`, enum, unique, CHECK nomlari) — migratsiyani qayta generatsiya qiling |
| `price` string qaytadi | `decimal` ustunga `transformer` qo'yilmagan |
| Parallel so'rovlarda 500 | Unique violation / lock xatosi 409 ga aylantirilmagan yoki lock yo'q |
| 413 o'rniga 500 | Filter `HttpException` bo'lmagan xatoning `status` ini saqlamaydi |
| Customer `POST /services` da 400 oladi (403 kutilgan) | Guard tartibi: `RolesGuard` validatsiyadan oldin ishlashi kerak (guard har doim pipe dan oldin — `@Roles` qo'yilganini va `JwtAuthGuard` global/ulanganini tekshiring) |
| Rol o'zgartirgach eski token yangi huquq bermaydi | Rol tokendan o'qilyapti; `JwtStrategy.validate` da DB dan o'qing |
| Fayl yuklashda diskda yetim fayllar | Validatsiyadan **oldin** diskka yozilyapti |
| Avatar URL `GET` 404 | Statik serve `UPLOAD_DIR` ga ulanmagan yoki global prefix ostida qolib ketgan |

Omad! Har bir milestone'ni alohida commit bilan yakunlang.
