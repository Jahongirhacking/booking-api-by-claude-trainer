# Booking & Reservation API: M3–M7 talablari

> Bu hujjat faqat **talablar va shartnomalar**. Implementatsiya sizniki. Hamma yo'llar `/api/v1` ostida.
> Testlar: `test/m3` … `test/m7`. Har bir `test:mN` o'zidan oldingi barcha milestone testlarini ham ishga tushiradi (regressiya).

## Umumiy sozlamalar (M3 dan boshlab)

`.env.test` ga qo'shing (va `.env`, `.env.example` ga ham, boshqa qiymatlar bilan):

```
JWT_SECRET=test-secret-at-least-32-characters-long
JWT_EXPIRES_IN=1h
BCRYPT_ROUNDS=4
UPLOAD_DIR=./uploads-test
```

`.gitignore` ga: `.env`, `.env.test`, `uploads/`, `uploads-test/`.

`package.json` scripts:

```json
"test:m3": "jest --config ./test/jest-m3.json --runInBand",
"test:m4": "jest --config ./test/jest-m4.json --runInBand",
"test:m5": "jest --config ./test/jest-m5.json --runInBand",
"test:m6": "jest --config ./test/jest-m6.json --runInBand",
"test:m7": "jest --config ./test/jest-m7.json --runInBand"
```

**Muhim:** M1/M2 dagi `services` e2e testlari endi `test/helpers/admin-headers.ts` orqali ishlaydi. Auth route yo'q paytda (M1–M2) bo'sh header, auth paydo bo'lgach (M3+) ADMIN token yuboradi. Shuning uchun M5 da `/services` yozish endpointlari ADMIN talab qilganda ham eski testlar yashil qoladi.

---

## M3: Authentication

**Maqsad:** Passport, JWT, Guard, parolni hashlash, `ConfigService` bilan secret boshqaruvi.

### Endpointlar
| Method | Path | Auth | Muvaffaqiyat | Xatolar |
|---|---|---|---|---|
| POST | `/auth/register` | ochiq | 201 `{ id, email, fullName, role }` | 400, 409 |
| POST | `/auth/login` | ochiq | 200 `{ accessToken }` | 400, 401 |
| GET | `/auth/me` | JWT | 200 `{ id, email, fullName, role }` | 401 |

### DTO
- **RegisterDto**: `email` (trim + lowercase, `IsEmail`), `fullName` (1–100), `password` (8–72 belgi, bcrypt chegarasi).
- **LoginDto**: `email`, `password`.

### Qoidalar
1. Ro'yxatdan o'tgan user har doim `CUSTOMER`. `role` yuborilsa 400 (`forbidNonWhitelisted`).
2. Parol **bcrypt** bilan hashlanadi. Rounds `BCRYPT_ROUNDS` dan (default 10). Hech qanday javobda parol/hash qaytmaydi.
3. Noto'g'ri parol va mavjud bo'lmagan email uchun **bir xil** 401 xabari (user enumeration oldini olish).
4. JWT payload: `sub` = user id. Boshqa maxfiy ma'lumot yo'q. Secret va muddat env dan.
5. `JwtStrategy.validate` foydalanuvchini DB dan yuklaydi, user o'chirilgan bo'lsa 401. Rol ham shu yerdan olinadi (M5 da kerak bo'ladi).
6. `alg: none`, imzosi buzilgan, boshqa secret bilan imzolangan, muddati o'tgan tokenlar 401.
7. `GET /health`, `GET /services` hamon ochiq.

### Shartnoma (testlar shunga tayanadi)
- `src/auth/password.ts` → `hashPassword(plain): Promise<string>`, `verifyPassword(plain, hash): Promise<boolean>`
- `JwtService` (`@nestjs/jwt`) DI dan olinadi (`app.get(JwtService, { strict: false })`) va `JWT_SECRET` bilan sozlangan bo'ladi.

### Paketlar
`pnpm add @nestjs/passport passport passport-jwt @nestjs/jwt bcrypt` va `pnpm add -D @types/passport-jwt @types/bcrypt`

### Edge case'lar
- `password` 73+ belgi bo'lsa bcrypt nima qiladi? Nega 72 bilan cheklaymiz?
- Parol taqqoslashda vaqt bo'yicha hujum (timing attack)? Nega `bcrypt.compare` ishlatamiz?
- Register da ikki parallel so'rov bir xil email bilan: 409 kafolatlanadimi, yoki 500mi?
- Guard `401` va `403` ni qachon beradi?

### Qabul mezonlari
- [ ] `pnpm run test:m3` yashil (M1–M2 regressiyasi bilan).
- [ ] `AuthService` controllerdan ajratilgan; `JwtStrategy` alohida provider.
- [ ] `JWT_SECRET` kodda qattiq yozilmagan; yo'q bo'lsa ilova ishga tushmaydi.

**Commit:** `feat(m3): register/login with bcrypt and JWT, JwtAuthGuard, /auth/me`

---

## M4: Booking biznes logikasi

**Maqsad:** servis qatlamidagi murakkab qoidalar, tranzaksiya, race condition, state machine.

### Endpointlar (hammasi JWT talab qiladi)
| Method | Path | Tavsif | Xatolar |
|---|---|---|---|
| POST | `/bookings` | `{ serviceId, staffId, startTime, notes? }` → 201 | 400, 401, 404, 409 |
| GET | `/bookings` | `?status=`. Ko'rinish doirasi rolga qarab | 400, 401 |
| GET | `/bookings/:id` | Faqat egasi / biriktirilgan staff / admin | 400, 401, 404 |
| PATCH | `/bookings/:id` | `{ startTime?, notes? }`, faqat PENDING ni ko'chirish | 400, 404, 409 |
| PATCH | `/bookings/:id/status` | `{ status }` | 400, 403, 404, 409 |

### Javob shakli (tekis, relationsiz)
`{ id, status, startTime, endTime, notes, customerId, staffId, serviceId, createdAt, updatedAt }`. Email, parol yoki ichki user obyekti javobga chiqmaydi.

### Qoidalar
1. `endTime = startTime + service.durationMinutes` (server hisoblaydi, klient yuborolmaydi).
2. `startTime` o'tmishda bo'lsa 400. ISO 8601 bo'lishi shart.
3. Service/staff topilmasa 404. Staff `isActive=false` bo'lsa 400.
4. **Overlap:** shu staffda `PENDING`/`CONFIRMED` bronlar bilan `[start, end)` kesishsa 409. Yonma-yon (end == start) ruxsat. `CANCELLED`/`COMPLETED` bandlik hisoblanmaydi.
5. **Race condition:** bir vaqtda kelgan ikkita bir xil slot so'rovida faqat bittasi 201, boshqasi 409 (500 emas).
6. **Ko'rinish:** CUSTOMER o'zinikini, STAFF unga biriktirilganlarni, ADMIN hammasini ko'radi. Ko'ra olmagan bron uchun **404** (mavjudligini sir saqlash). Ro'yxat `startTime` o'sish tartibida.
7. **State machine:** `PENDING→CONFIRMED|CANCELLED`, `CONFIRMED→COMPLETED|CANCELLED`. `CANCELLED` va `COMPLETED` yakuniy. Noto'g'ri o'tish va bir xil statusga o'tish → **409**. Noma'lum status qiymati → **400**.
8. **Kim nima qila oladi:** CUSTOMER faqat o'z bronini `CANCELLED` qiladi (boshqasi → 403). Biriktirilgan STAFF va ADMIN har qanday to'g'ri o'tishni bajaradi.
9. `COMPLETED` ga faqat `startTime` o'tgan bronlar o'tadi (aks holda 409).
10. PATCH: faqat PENDING bron ko'chiriladi (aks holda 409). Ko'chirishda overlap tekshiruvi **o'zini hisobga olmaydi**. `status/staffId/serviceId/endTime` yuborilsa 400.
11. Bekor qilingach slot bo'shaydi.

### Shartnoma
`src/bookings/booking.rules.ts`: sof funksiyalar
- `calculateEndTime(startTime: Date, durationMinutes: number): Date` (kirishni o'zgartirmaydi)
- `canTransition(from: string, to: string): boolean`
- `intervalsOverlap(aStart, aEnd, bStart, bEnd): boolean` (yarim ochiq `[start, end)`)

### Edge case'lar
- "Avval tekshir, keyin yoz" race condition beradi. Yechim variantlari: tranzaksiya + qulf (pessimistic lock), Postgres exclusion constraint. Qaysi biri nima uchun?
- Vaqt zonasi: klient `+05:00` bilan yuborsa nima saqlanadi, nima qaytadi?
- Controllerda `if (user.role === ...)` o'rniga servis qatlami qanday qaror qiladi?

### Qabul mezonlari
- [ ] `pnpm run test:m4` yashil.
- [ ] Qoidalar (`booking.rules.ts`) NestJS/DB dan mustaqil.
- [ ] Yaratish va ko'chirish bitta tranzaksiyada.

**Commit:** `feat(m4): booking creation with overlap protection, status machine, role-scoped visibility`

---

## M5: RBAC va Request processing

**Maqsad:** `Reflector`, custom decorator, `RolesGuard`, middleware, interceptor, custom pipe, filter.

### Shartnoma
- `src/auth/decorators/roles.decorator.ts` → `@Roles(...roles: string[])`
- `src/auth/guards/roles.guard.ts` → `RolesGuard(reflector)`: `request.user.role` ni tekshiradi. `@Roles` yo'q bo'lsa ruxsat. Method darajasi class darajasini **override** qiladi. `user` yo'q bo'lsa `false`.
- `@CurrentUser()` param decorator (nomi sizniki, `/auth/me` va servislarda ishlating).

### Endpointlar

| Method | Path | Kim | Natija |
|---|---|---|---|
| POST | `/services` | ADMIN | 201 |
| PATCH | `/services/:id` | ADMIN | 200 |
| DELETE | `/services/:id` | ADMIN | 204 |
| GET | `/users` | ADMIN | 200 `[{ id, email, fullName, role, createdAt }]` |
| PATCH | `/users/:id/role` | ADMIN | `{ role }` → 200. Admin o'z rolini pasaytirsa 409 |
| POST | `/staff` | ADMIN | `{ userId, specialization? }` → 201 `{ id, userId, specialization, isActive }`. User roli `STAFF` bo'ladi. User yo'q 404, allaqachon staff 409 |
| GET | `/staff` | har qanday JWT | `[{ id, userId, fullName, specialization, isActive }]`, email yo'q |
| PATCH | `/staff/:id` | ADMIN | `{ isActive?, specialization? }` |
| POST | `/bookings` | CUSTOMER, ADMIN | ADMIN `customerId` ni **majburiy** beradi (yo'q → 400, noma'lum → 404). CUSTOMER `customerId` yuborsa 403. STAFF → 403 |
| GET | `/bookings` | JWT | Yangi: `?from=&to=` (`[from, to)` bo'yicha `startTime`) |

### Qoidalar
1. **Guard tartibi:** 401 → 403 → validatsiya (400) → 404. Ya'ni mijoz noto'g'ri body yoki mavjud bo'lmagan id bilan ham **403** oladi.
2. **Rol har so'rovda DB dan:** admin rolni o'zgartirsa, foydalanuvchining ESKI tokeni yangi huquqlarni darhol oladi (qayta login shart emas).
3. **Request-ID middleware:** har bir javobda `x-request-id` (uuid). Mijoz yaroqli uuid yuborsa shu qaytariladi. Yaroqsiz bo'lsa yangi uuid (yuborilgan qiymat aks ettirilmaydi). 404 javobda ham.
4. **Response-time interceptor:** muvaffaqiyatli javobda `x-response-time: <son>ms`.
5. **Exception filter:** barcha xato javoblarda `requestId` (header bilan bir xil).
6. **Custom pipe:** `from`/`to` uchun (masalan `ParseIsoDatePipe`): ISO bo'lmasa 400. `from > to` → 400.

### Edge case'lar
- Middleware `forRoutes('*')` global prefix bilan qanday ishlaydi? 404 route'lar uchun ham ishlaydimi?
- Interceptor xato javoblarida ishlamaydi. Nega? Qaysi qatlam ishlaydi?
- `APP_GUARD` bilan global guard va `@Public()` decorator yondashuvi qachon yaxshiroq?
- `RolesGuard` ni `JwtAuthGuard` dan oldin qo'ysangiz nima bo'ladi?

### Qabul mezonlari
- [ ] `pnpm run test:m5` yashil.
- [ ] Controllerlarda qo'lda `if (role !== ...) throw` yo'q. Faqat decorator + guard.

**Commit:** `feat(m5): roles guard, admin endpoints, request-id middleware, response-time interceptor`

---

## M6: File upload

**Maqsad:** `FileInterceptor`, Multer, fayl validatsiyasi, storage servisi (custom provider), statik fayl berish, yetim fayllarni boshqarish.

### Endpointlar
| Method | Path | Kim | Natija |
|---|---|---|---|
| POST | `/users/me/avatar` | JWT | multipart, field **`file`** → 201 `{ avatarUrl }` |
| DELETE | `/users/me/avatar` | JWT | 204 (avatar bo'lmasa ham 204) |
| POST | `/services/:id/image` | ADMIN | multipart, field `file` → 201 `{ imageUrl }` |
| GET | `avatarUrl` / `imageUrl` | ochiq | Faylni to'g'ri `Content-Type` bilan qaytaradi |

Entitylarga qo'shiladi (migratsiya bilan!): `User.avatarUrl?`, `Service.imageUrl?` (+ diskdagi fayl nomi/yo'li uchun kerakli maydon). `GET /auth/me` va `GET /services/:id` javobida `avatarUrl` / `imageUrl` (yo'q bo'lsa `null`).

### Qoidalar
1. Ruxsat etilgan turlar: PNG, JPEG, WEBP. Tur **magic bytes** bo'yicha aniqlanadi (mijozning `Content-Type` yoki kengaytmasiga ishonilmaydi). SVG va matn → 400.
2. Hajm: ko'pi bilan **2 MB** (aynan 2 MB ruxsat). Oshsa **413**.
3. Fayl yo'q, noto'g'ri field nomi, bir nechta fayl, bo'sh fayl → 400.
4. Saqlangan nom tasodifiy (uuid), kengaytma **aniqlangan turdan**. Asl nom (va `../` kabi qismlar) ishlatilmaydi. Fayl faqat `UPLOAD_DIR` ichida.
5. Rad etilgan yuklashdan keyin diskda **hech narsa qolmaydi**.
6. Qayta yuklash eski faylni o'chiradi. Xizmat o'chirilsa rasmi ham o'chadi.
7. `UPLOAD_DIR` yo'q bo'lsa servis o'zi yaratadi.
8. Storage mantig'i (`StorageService`) controllerdan ajratilgan custom provider.

### Shartnoma
`src/uploads/image-type.ts` → `detectImageType(buffer: Buffer): 'png' | 'jpeg' | 'webp' | null`. Faqat dastlabki baytlarga qaraydi, qisqa/bo'sh buffer uchun xato tashlamaydi.

### Edge case'lar
- `FileTypeValidator` faqat `mimetype` ga qaraydi. Soxta `Content-Type` ni qanday ushlaysiz?
- Multer xotirada (`memoryStorage`) yoki diskda? 2 MB uchun qaysi biri xavfsizroq, katta fayllarda-chi?
- Validatsiyadan keyin diskka yozish yoki avval yozib keyin o'chirish? Yetim fayl qachon qoladi?
- Statik berishda global prefix (`api/v1`) bilan nima qilish kerak? Nega URL `/uploads/...` bo'lishi mumkin?

### Qabul mezonlari
- [ ] `pnpm run test:m6` yashil.
- [ ] `UPLOAD_DIR` env dan, kodda qattiq yo'l yo'q.

**Commit:** `feat(m6): avatar and service image upload with magic-byte validation and storage service`

---

## M7: Yakuniy integratsiya

**Maqsad:** hamma narsani birlashtirish, xavfsizlik va barqarorlikni tekshirish. Yangi endpoint yo'q.

### Nimani tekshiradi
- **Sayohat testi** (`journey.e2e-spec.ts`): xizmat yaratish → staff tayinlash → mijoz ro'yxatdan o'tishi → bron → overlap → tasdiqlash → bekor qilish → slot bo'shashi → completed → upload → staffni nofaol qilish.
- **Rol matritsasi** (`security.e2e-spec.ts`): 10 ta endpoint × 4 rol (anonim/customer/staff/admin) = 40 holat.
- **Sizib chiqmaslik:** hech bir javobda `passwordHash`, bcrypt hash yoki ochiq parol yo'q.
- **Yagona xato formati:** 400/401/403/404/409 hammasida `{ statusCode, message, path, timestamp, requestId }`. Stack trace va SQL tafsilotlari yo'q.
- **Zararli kirish:** SQL injection urinishlari, juda katta body (413), unicode, mass-assignment.
- **Concurrency:** 6 parallel so'rov bir slotga → aynan 1 ta 201, 5 ta 409, 5xx yo'q.

### Yakuniy checklist (testdan tashqari)
- [ ] `pnpm run test:m7` to'liq yashil (M1–M7).
- [ ] `pnpm run build` xatosiz. `pnpm run lint` toza.
- [ ] Bo'sh bazada `migration:run` noldan ishlaydi. `migration:revert` ham.
- [ ] `.env.example` bor, `.env`/`.env.test` repoda yo'q.
- [ ] README: ishga tushirish, env, migratsiya, testlar.

**Commit:** `chore(m7): final integration, security hardening and docs`
