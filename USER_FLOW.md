# Foydalanuvchi oqimi va UX — rollar bo'yicha

Bu hujjat Booking API'ning yakuniy ko'rinishida har bir rol (Mehmon, Mijoz, Xodim, Admin) nima qila olishini, qaysi ekranlarni ko'rishini va qaysi API chaqiriladi­ganini tavsiflaydi. API tafsilotlari uchun [API.md](API.md) ga qarang.

## 1. Rollar xulosasi

| Rol | Kim | Asosiy maqsad | Token |
|-----|-----|---------------|-------|
| **Mehmon** (Guest) | Ro'yxatdan o'tmagan | Xizmat va xodimlarni ko'rish, ro'yxatdan o'tish | Yo'q |
| **CUSTOMER** (Mijoz) | Ro'yxatdan o'tgan oddiy foydalanuvchi | Xizmatga bron qilish va boshqarish | Bor |
| **STAFF** (Xodim) | Xizmat ko'rsatuvchi (masalan sartarosh) | O'z bronlarini tasdiqlash va yakunlash | Bor |
| **ADMIN** | Tizim boshqaruvchisi | Xizmat, xodim, foydalanuvchi va barcha bronlarni boshqarish | Bor |

## 2. Umumiy holatlar (barcha rollar uchun)

### Bron holatlari (status)

```
PENDING ──► CONFIRMED ──► COMPLETED
   │            │
   └────────────┴──► CANCELLED
```

- `PENDING` — mijoz yaratdi, xodim hali tasdiqlamadi.
- `CONFIRMED` — xodim/admin tasdiqladi.
- `COMPLETED` — xizmat ko'rsatildi (faqat `CONFIRMED` dan).
- `CANCELLED` — bekor qilindi (`COMPLETED` dan keyin mumkin emas).

### Umumiy UX qoidalari

| Holat | Foydalanuvchiga ko'rinishi |
|-------|----------------------------|
| Yuklanmoqda | Skeleton/spinner, tugmalar o'chirilgan (ikki marta bosishdan himoya) |
| `400` validatsiya xatosi | Xato matni mos maydon ostida qizil rangda |
| `401` token yo'q/muddati tugagan | Avtomatik Login sahifasiga yo'naltirish, "Sessiya tugadi, qayta kiring" xabari; kirgandan so'ng avvalgi sahifaga qaytarish |
| `403` ruxsat yo'q | "Sizda bu amal uchun ruxsat yo'q" sahifasi, bosh sahifaga havola |
| `404` topilmadi | "Topilmadi" sahifasi |
| `409` ziddiyat | Aniq sabab: "Bu vaqt band", "Email allaqachon ro'yxatdan o'tgan" |
| Muvaffaqiyat | Qisqa toast xabar ("Bron yaratildi") |
| Bo'sh ro'yxat | Tushuntiruvchi matn + keyingi qadam tugmasi ("Hali bron yo'q — Bron qilish") |
| Xavfli amal (o'chirish, bekor qilish) | Tasdiqlash oynasi (modal) |

Token `Authorization: Bearer <accessToken>` sarlavhasida yuboriladi va 1 soatdan keyin tugaydi.

---

## 3. MEHMON (Guest) — token yo'q

### Oqim

```
Bosh sahifa ─► Xizmatlar ro'yxati ─► Xizmat tafsiloti ─► [Bron qilish] ─► Login/Ro'yxatdan o'tish
        └────► Xodimlar ro'yxati ─► Xodim tafsiloti ─► Bo'sh vaqtlar
```

### Ekranlar va amallar

| Ekran | Nima qila oladi | API |
|-------|-----------------|-----|
| Bosh sahifa | Xizmatlar va xodimlarni ko'radi | `GET /services`, `GET /staff` |
| Xizmatlar ro'yxati | Qidirish, sahifalash | `GET /services?search=&page=` |
| Xizmat tafsiloti | Nomi, tavsifi, davomiyligi, narxi, rasmi | `GET /services/:id` |
| Xodim tafsiloti | Mutaxassisligi, bo'sh vaqt jadvali | `GET /staff/:id`, `GET /staff/:id/availability` |
| Ro'yxatdan o'tish | Email, parol, to'liq ism | `POST /auth/register` |
| Kirish | Email va parol | `POST /auth/login` |

### UX tafsilotlari

- Mehmon barcha ma'lumotni **kirishsiz** ko'ra oladi — kirish faqat bron qilish paytida so'raladi.
- **[Bron qilish]** tugmasini bossa → Login sahifasiga o'tadi; kirgach, xuddi shu xizmat bron formasiga qaytadi (tanlov yo'qolmaydi).
- Ro'yxatdan o'tgach, foydalanuvchi **avtomatik Login qilinadi** (frontend `register` dan so'ng `login` ni chaqiradi) va rol doim `CUSTOMER` bo'ladi.
- Xatolar: `409` → "Bu email band, kirishni sinab ko'ring" (Login havolasi bilan); `401` → "Email yoki parol noto'g'ri" (qaysi biri ekanini aytmaslik — xavfsizlik uchun).

---

## 4. CUSTOMER (Mijoz)

### Asosiy oqim — bron yaratish

```
1. Xizmat tanlash ─► 2. Xodim tanlash ─► 3. Sana tanlash ─► 4. Bo'sh vaqt tanlash ─► 5. Izoh + Tasdiqlash ─► 6. Bron yaratildi (PENDING)
```

| Qadam | Ekran | API |
|-------|-------|-----|
| 1 | Xizmatlar ro'yxati | `GET /services` |
| 2 | Shu xizmatni ko'rsata oladigan faol xodimlar | `GET /staff` |
| 3 | Kalendar (o'tgan sanalar o'chirilgan) | — |
| 4 | Bo'sh vaqt tugmalari (xizmat davomiyligiga mos) | `GET /staff/:id/availability?date=&serviceId=` |
| 5 | Xulosa: xizmat, xodim, vaqt, narx, izoh (≤ 500 belgi) | — |
| 6 | Muvaffaqiyat ekrani → "Mening bronlarim" | `POST /bookings` |

### Boshqa ekranlar

| Ekran | Amallar | API |
|-------|---------|-----|
| **Mening bronlarim** | Holat bo'yicha filtr (Kutilmoqda / Tasdiqlangan / Yakunlangan / Bekor), sahifalash | `GET /bookings?status=` |
| **Bron tafsiloti** | Xizmat, xodim, vaqt, holat, izoh | `GET /bookings/:id` |
| **Bronni o'zgartirish** | Vaqt, xodim, izohni o'zgartirish — **faqat `PENDING` paytida** | `PATCH /bookings/:id` |
| **Bronni bekor qilish** | Tasdiqlash modali → `CANCELLED` | `PATCH /bookings/:id/status` |
| **Profil** | Ism va rasmni o'zgartirish | `GET/PATCH /auth/me` |
| **Parolni almashtirish** | Joriy va yangi parol | `PATCH /auth/me/password` |
| **Chiqish** | Tokenni o'chirish (frontend tomonida) | — |

### UX tafsilotlari

- **Band vaqtlar** ko'rsatilmaydi (yoki o'chirilgan holda). Agar tanlash va yuborish orasida boshqa mijoz band qilib qo'ysa → `409` → "Bu vaqt hozirgina band bo'ldi, boshqa vaqt tanlang" va vaqtlar ro'yxati qayta yuklanadi.
- Bron holatlari **rangli nishon** bilan: sariq — Kutilmoqda, yashil — Tasdiqlangan, ko'k — Yakunlangan, kulrang — Bekor.
- `CONFIRMED` bronda "O'zgartirish" tugmasi **yashirin**; faqat "Bekor qilish" qoladi. Sabab tushuntiriladi: "Tasdiqlangan bronni o'zgartirish uchun bekor qilib, qayta bron qiling".
- `COMPLETED` va `CANCELLED` bronlarda hech qanday amal tugmasi yo'q.
- Mijoz **faqat o'z bronlarini** ko'radi; boshqaning bronini ochsa → `403`.
- Mijoz xodim ham, admin ham paneliga kira olmaydi (menyuda ko'rinmaydi, to'g'ridan-to'g'ri havola → `403`).

---

## 5. STAFF (Xodim)

### Asosiy oqim — kundalik ish

```
Kirish ─► Bugungi jadval ─► Yangi (PENDING) bronni ko'rish ─► Tasdiqlash / Bekor qilish ─► Xizmatdan so'ng "Yakunlash"
```

| Ekran | Amallar | API |
|-------|---------|-----|
| **Bugungi jadval** | Bugungi bronlar vaqt bo'yicha | `GET /bookings?from=&to=` (faqat o'ziga tayinlanganlar) |
| **Yangi so'rovlar** | `PENDING` bronlar, "Tasdiqlash" / "Rad etish" | `GET /bookings?status=PENDING` |
| **Bron tafsiloti** | Mijoz ismi, xizmat, vaqt, izoh | `GET /bookings/:id` |
| **Tasdiqlash** | `PENDING → CONFIRMED` | `PATCH /bookings/:id/status` |
| **Yakunlash** | `CONFIRMED → COMPLETED` | `PATCH /bookings/:id/status` |
| **Bekor qilish** | Sabab bilan, modal orqali | `PATCH /bookings/:id/status` |
| **Profil** | Ism, rasm, parol | `GET/PATCH /auth/me`, `PATCH /auth/me/password` |

### UX tafsilotlari

- Xodim **faqat o'ziga tayinlangan** bronlarni ko'radi. Boshqa xodim bronini ochsa → `403`.
- Bosh sahifada **yangi so'rovlar soni** (badge) ko'rsatiladi — eng tez e'tibor talab qiladigan narsa shu.
- "Yakunlash" tugmasi **faqat `CONFIRMED`** va bron vaqti kelgach faol; aks holda yashirin yoki o'chirilgan.
- Noto'g'ri o'tish (masalan, `PENDING` ni to'g'ridan-to'g'ri yakunlash) → `409` → "Avval bronni tasdiqlang".
- Xodim xizmat, xodim yoki foydalanuvchi ro'yxatini **o'zgartira olmaydi**; faqat o'z `isActive` holatini admin boshqaradi (ta'til uchun admindan so'raladi).
- Xodim mijoz sifatida bron qila olmaydi (`POST /bookings` → `403`).

---

## 6. ADMIN

### Asosiy oqimlar

**A) Yangi xodim qo'shish**

```
Foydalanuvchi ro'yxati ─► Foydalanuvchini tanlash ─► "Xodim qilish" + mutaxassislik ─► Xodim yaratildi (rol → STAFF)
```

**B) Yangi xizmat qo'shish**

```
Xizmatlar ─► [Yangi xizmat] ─► Nomi, tavsifi, davomiyligi (5–480 daq.), narxi, rasm ─► Saqlash
```

**C) Bronlarni nazorat qilish**

```
Barcha bronlar ─► Filtr (holat, xodim, xizmat, sana) ─► Bron tafsiloti ─► Holatni o'zgartirish / o'chirish
```

### Ekranlar va amallar

| Bo'lim | Amallar | API |
|--------|---------|-----|
| **Dashboard** | Bugungi bronlar, kutilayotganlar soni | `GET /bookings` |
| **Foydalanuvchilar** | Qidirish, rol bo'yicha filtr, tafsilot | `GET /users`, `GET /users/:id` |
| | Rolni o'zgartirish | `PATCH /users/:id/role` |
| | O'chirish (bronlari bo'lmasa) | `DELETE /users/:id` |
| **Xizmatlar** | Yaratish / tahrirlash / o'chirish | `POST`, `PATCH`, `DELETE /services` |
| **Xodimlar** | Xodim qilish, mutaxassislikni tahrirlash | `POST`, `PATCH /staff` |
| | Faol/nofaol qilish (ta'til, ishdan ketish) | `PATCH /staff/:id` (`isActive`) |
| | Xodim profilini o'chirish | `DELETE /staff/:id` |
| **Bronlar** | Barchasini ko'rish, tahrirlash, har qanday holatga o'tkazish* | `GET`, `PATCH`, `DELETE /bookings` |
| | Mijoz nomidan bron yaratish (telefon orqali qo'ng'iroq qilganda) | `POST /bookings` (`customerId` bilan) |

\* Noqonuniy o'tishlar (masalan, `COMPLETED` → `CANCELLED`) admin uchun ham `409`.

### UX tafsilotlari

- **O'chirish o'rniga nofaollashtirish tavsiya etiladi.** Bronlari bor xodim/xizmat/foydalanuvchini o'chirish `409` beradi; xabar: "Bu yozuvga bronlar bog'langan. O'chirish o'rniga nofaol qiling." Xodim uchun "Nofaol qilish" tugmasi taklif qilinadi.
- Xodim nofaol qilinganda, uning **kelajakdagi bronlari** haqida ogohlantirish chiqadi (ro'yxat bilan).
- Xavfli amallar (o'chirish, rolni `ADMIN` ga o'zgartirish) — **ikki bosqichli tasdiqlash** (modal, nom yozib tasdiqlash).
- Admin o'zining rolini pasaytira olmasligi kerak (oxirgi admin yo'qolib qolmasligi uchun) — frontendda tugma o'chirilgan, backendda `409`.
- Jadvallarda **sahifalash va filtr holati URL'da** saqlanadi (sahifani yangilaganda yo'qolmaydi).
- Admin ham mijoz kabi o'z profilini boshqaradi.

---

## 7. Ruxsatlar jadvali (qisqacha)

| Amal | Mehmon | CUSTOMER | STAFF | ADMIN |
|------|:------:|:--------:|:-----:|:-----:|
| Xizmat/xodim ro'yxatini ko'rish | ✅ | ✅ | ✅ | ✅ |
| Bo'sh vaqtlarni ko'rish | ✅ | ✅ | ✅ | ✅ |
| Ro'yxatdan o'tish / kirish | ✅ | — | — | — |
| O'z profilini ko'rish/tahrirlash | ❌ | ✅ | ✅ | ✅ |
| Bron yaratish | ❌ | ✅ | ❌ | ✅ |
| O'z bronlarini ko'rish | ❌ | ✅ | ✅ (tayinlangan) | ✅ (barchasi) |
| Bronni tahrirlash | ❌ | ✅ (`PENDING`) | ❌ | ✅ |
| Bronni tasdiqlash / yakunlash | ❌ | ❌ | ✅ (o'ziniki) | ✅ |
| Bronni bekor qilish | ❌ | ✅ (o'ziniki) | ✅ (o'ziniki) | ✅ |
| Xizmat yaratish/tahrirlash/o'chirish | ❌ | ❌ | ❌ | ✅ |
| Xodim boshqarish | ❌ | ❌ | ❌ | ✅ |
| Foydalanuvchi va rollarni boshqarish | ❌ | ❌ | ❌ | ✅ |

## 8. To'liq hayotiy sikl (misol)

```
1. Mehmon "Soch olish" xizmatini ko'radi                       (GET /services)
2. [Bron qilish] bosadi → ro'yxatdan o'tadi                    (POST /auth/register, /auth/login)
3. Mijoz xodim va bo'sh vaqtni tanlaydi                        (GET /staff/:id/availability)
4. Bron yaratadi → holat PENDING                               (POST /bookings)
5. Xodim "Yangi so'rovlar"da ko'radi va tasdiqlaydi            (PATCH /bookings/:id/status → CONFIRMED)
6. Mijoz "Mening bronlarim"da CONFIRMED holatini ko'radi
7. Xizmat ko'rsatilgach, xodim yakunlaydi                      (PATCH .../status → COMPLETED)
8. Admin Dashboard'da statistikani kuzatadi                    (GET /bookings)
```

> **Eslatma:** hozircha faqat `health` va `auth` (register, login, me) amalga oshirilgan. Qolgan oqimlar [API.md](API.md) dagi rejaga muvofiq keyingi bosqichlarda quriladi.
