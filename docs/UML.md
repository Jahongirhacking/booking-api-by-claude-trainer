# UML: Booking & Reservation API

> Backend dasturchi uchun: entitylar orasidagi bog'lanishlar, modullar tuzilmasi, so'rov yo'li va holatlar mashinasi.
> Diagrammalar [Mermaid](https://mermaid.js.org/) formatida (GitHub, VS Code "Markdown Preview Mermaid Support" kengaytmasida ko'rinadi).
> Talablar: [ASSIGNMENT.md](ASSIGNMENT.md), [milestones.md](milestones.md).

---

## 1. Entity munosabatlari (ER / klass diagrammasi)

Entity klass nomlari testlar uchun aynan `User`, `Service`, `Staff`, `Booking` bo'lishi shart.

```mermaid
classDiagram
    direction LR

    class User {
        +uuid id  «PK»
        +string email  «UNIQUE»
        +string fullName
        +string passwordHash
        +Role role  «default CUSTOMER»
        +string avatarUrl?  «M6»
        +string avatarFile?  «M6»
        +timestamptz createdAt
    }

    class Staff {
        +uuid id  «PK»
        +uuid userId  «FK, UNIQUE»
        +string specialization?
        +boolean isActive  «default true»
    }

    class Service {
        +uuid id  «PK»
        +string name  «UNIQUE»
        +string description?
        +int durationMinutes  «5..480»
        +decimal price  «JS da number»
        +string imageUrl?  «M6»
        +string imageFile?  «M6»
        +timestamptz createdAt
        +timestamptz updatedAt
    }

    class Booking {
        +uuid id  «PK»
        +uuid customerId  «FK»
        +uuid staffId  «FK»
        +uuid serviceId  «FK»
        +timestamptz startTime
        +timestamptz endTime  «CHECK endTime > startTime»
        +BookingStatus status  «default PENDING»
        +string notes?  «max 500»
        +timestamptz createdAt
        +timestamptz updatedAt
    }

    class Role {
        <<enumeration>>
        ADMIN
        STAFF
        CUSTOMER
    }

    class BookingStatus {
        <<enumeration>>
        PENDING
        CONFIRMED
        CANCELLED
        COMPLETED
    }

    User "1" -- "0..1" Staff : OneToOne (staff profili)
    User "1" -- "0..*" Booking : customer (ManyToOne)
    Staff "1" -- "0..*" Booking : xizmat ko'rsatadi (ManyToOne)
    Service "1" -- "0..*" Booking : buyurtma qilingan (ManyToOne)
    User ..> Role
    Booking ..> BookingStatus
```

**Bog'lanish qoidalari (DB darajasida):**

| Munosabat | Turi | Cheklov |
|---|---|---|
| `Staff.user → User` | OneToOne | `UNIQUE(userId)`: bitta user ikki marta staff bo'lolmaydi (`23505`) |
| `Booking.customer → User` | ManyToOne | FK `RESTRICT`: bron bor userni o'chirib bo'lmaydi (`23503`) |
| `Booking.staff → Staff` | ManyToOne | FK `RESTRICT` (`23503`) |
| `Booking.service → Service` | ManyToOne | FK `RESTRICT`: API da **409** ga xaritalanadi |
| `Booking` | CHECK | `endTime > startTime` (`23514`) |
| `User.email`, `Service.name` | UNIQUE | `23505` → API da **409** |

---

## 2. Modullar tuzilmasi (komponent diagrammasi)

```mermaid
flowchart TB
    subgraph Bootstrap["Bootstrap"]
        main["main.ts"]
        setup["app.setup.ts<br/>configureApp()"]
        appmod["AppModule"]
    end

    subgraph Common["common/ (global qatlam)"]
        mw["RequestIdMiddleware<br/>x-request-id"]
        ic["ResponseTimeInterceptor<br/>x-response-time"]
        flt["AllExceptionsFilter<br/>{statusCode,message,path,timestamp,requestId}"]
        vp["ValidationPipe<br/>whitelist + forbidNonWhitelisted"]
        iso["ParseIsoDatePipe"]
    end

    subgraph DB["database/"]
        ds["data-source.ts"]
        mig["migrations/"]
        ent[("Entities:<br/>User, Service, Staff, Booking")]
    end

    subgraph Auth["auth/"]
        ac["AuthController"]
        as["AuthService"]
        js["JwtStrategy<br/>(userni DB dan yuklaydi)"]
        jg["JwtAuthGuard"]
        rg["RolesGuard"]
        rd["@Roles() / @CurrentUser()"]
        pw["password.ts<br/>hashPassword / verifyPassword"]
    end

    subgraph Users["users/"]
        uc["UsersController<br/>GET /users, PATCH /:id/role<br/>POST|DELETE /me/avatar"]
        us["UsersService"]
    end

    subgraph StaffM["staff/"]
        sc["StaffController"]
        ss["StaffService"]
    end

    subgraph Services["services/"]
        svc["ServicesController"]
        svs["ServicesService"]
    end

    subgraph Bookings["bookings/"]
        bc["BookingsController"]
        bs["BookingsService<br/>(tranzaksiya + lock)"]
        br["booking.rules.ts<br/>calculateEndTime / canTransition / intervalsOverlap<br/>(sof funksiyalar)"]
    end

    subgraph Uploads["uploads/"]
        st["StorageService<br/>(custom provider)"]
        it["image-type.ts<br/>detectImageType()"]
    end

    health["HealthController<br/>GET /health"]
    disk[("UPLOAD_DIR<br/>(disk)")]

    main --> setup --> appmod
    setup -.-> vp
    setup -.-> flt
    setup -.-> ic
    appmod -.-> mw

    appmod --> Auth & Users & StaffM & Services & Bookings & Uploads & health

    ac --> as --> pw
    as --> ent
    js --> ent
    jg --> js
    rg --> rd

    uc --> us --> ent
    us --> st
    sc --> ss --> ent
    svc --> svs --> ent
    svs --> st
    bc --> bs --> ent
    bs --> br
    bc -.-> iso

    st --> it
    st --> disk
    health --> ds
    ds --> mig
    mig --> ent
```

**Bog'liqlik yo'nalishi:** Controller → Service → Repository/Entity. `booking.rules.ts` NestJS va DB dan mustaqil (unit-testlanadi). `StorageService` `UsersService` va `ServicesService` tomonidan ishlatiladi; controllerlar diskka bevosita tegmaydi.

---

## 3. Endpointlar va rollar (kim nimaga kira oladi)

```mermaid
flowchart LR
    anon(["Anonim"]) --> pub["GET /health<br/>GET /services, /services/:id<br/>POST /auth/register, /auth/login<br/>GET /uploads/*"]
    cust(["CUSTOMER"]) --> c1["GET /auth/me<br/>GET /staff<br/>POST /bookings (o'zi uchun)<br/>GET /bookings, /bookings/:id (o'zinikini)<br/>PATCH /bookings/:id (PENDING)<br/>PATCH /bookings/:id/status (faqat CANCELLED)<br/>POST|DELETE /users/me/avatar"]
    stf(["STAFF"]) --> s1["GET /auth/me, GET /staff<br/>GET /bookings (o'ziga biriktirilgan)<br/>PATCH /bookings/:id/status (to'g'ri o'tishlar)<br/>POST|DELETE /users/me/avatar<br/>(POST /bookings: 403)"]
    adm(["ADMIN"]) --> a1["Hammasi: POST|PATCH|DELETE /services<br/>POST /services/:id/image<br/>GET /users, PATCH /users/:id/role<br/>POST|PATCH /staff<br/>POST /bookings (customerId majburiy)<br/>GET /bookings (hammasi)"]
```

**Guard tartibi:** `JwtAuthGuard` (401) → `RolesGuard` (403) → Pipe/Validatsiya (400) → Servis (404/409).

---

## 4. So'rov hayotiy sikli (sequence): `POST /api/v1/bookings`

```mermaid
sequenceDiagram
    autonumber
    actor C as Mijoz
    participant MW as RequestId Middleware
    participant JG as JwtAuthGuard / JwtStrategy
    participant RG as RolesGuard
    participant IC as ResponseTime Interceptor
    participant VP as ValidationPipe
    participant BC as BookingsController
    participant BS as BookingsService
    participant BR as booking.rules
    participant DB as PostgreSQL
    participant EF as ExceptionFilter

    C->>MW: POST /api/v1/bookings (Bearer token)
    MW->>MW: x-request-id = yaroqli uuid yoki yangi uuid
    MW->>JG: so'rov
    JG->>DB: user ni id (sub) bo'yicha yuklash (rol DB dan)
    alt token yaroqsiz / user yo'q
        JG-->>EF: 401
    end
    JG->>RG: request.user
    alt rol CUSTOMER/ADMIN emas
        RG-->>EF: 403
    end
    RG->>IC: ruxsat
    IC->>VP: DTO validatsiya
    alt noto'g'ri body
        VP-->>EF: 400
    end
    VP->>BC: CreateBookingDto
    BC->>BS: create(user, dto)
    BS->>DB: BEGIN
    BS->>DB: Service va Staff ni yuklash (404 / staff nofaol → 400)
    BS->>DB: staff qatorini SELECT ... FOR UPDATE (pessimistic lock)
    BS->>BR: calculateEndTime(start, duration)
    BS->>DB: PENDING/CONFIRMED bronlarni olish
    BS->>BR: intervalsOverlap(...) har biri uchun
    alt kesishsa
        BS->>DB: ROLLBACK
        BS-->>EF: 409
    else bo'sh
        BS->>DB: INSERT booking
        BS->>DB: COMMIT
    end
    BS-->>BC: Booking
    BC-->>IC: tekis javob (relationsiz)
    IC-->>C: 201 + x-request-id + x-response-time
    EF-->>C: xato: {statusCode, message, path, timestamp, requestId}
```

---

## 5. Booking holatlar mashinasi (state machine)

`canTransition(from, to)` aynan shu jadvalni amalga oshiradi.

```mermaid
stateDiagram-v2
    [*] --> PENDING : POST /bookings
    PENDING --> CONFIRMED : STAFF (biriktirilgan) / ADMIN
    PENDING --> CANCELLED : CUSTOMER (egasi) / STAFF / ADMIN
    CONFIRMED --> COMPLETED : STAFF / ADMIN (startTime o'tgan bo'lsa)
    CONFIRMED --> CANCELLED : CUSTOMER (egasi) / STAFF / ADMIN
    COMPLETED --> [*]
    CANCELLED --> [*]

    note right of PENDING
        Faqat PENDING ko'chiriladi
        (PATCH /bookings/:id)
    end note
    note right of CANCELLED
        Yakuniy holat: slot bo'shaydi.
        Bandlik faqat PENDING va CONFIRMED
        bronlar bilan hisoblanadi.
    end note
```

Boshqa barcha o'tishlar (shu jumladan bir xil statusga o'tish) → **409**. Noma'lum status qiymati → **400**. Mijoz `CANCELLED` dan boshqa statusga o'tkaza olmaydi → **403**.

---

## 6. Overlap qoidasi (vaqt oralig'i, yarim ochiq `[start, end)`)

```mermaid
gantt
    dateFormat HH:mm
    axisFormat %H:%M
    title Staff A, mavjud bron 10:00-10:30 (PENDING)

    section Mavjud
    Bron (band)            :done, b0, 10:00, 30m

    section 409 (kesishadi)
    09:45-10:15 (boshida)  :crit, x1, 09:45, 30m
    10:15-10:45 (ichidan)  :crit, x2, 10:15, 30m
    10:00-10:30 (bir xil)  :crit, x3, 10:00, 30m

    section 201 (kesishmaydi)
    09:30-10:00 (yonma-yon oldin) :active, y1, 09:30, 30m
    10:30-11:00 (yonma-yon keyin) :active, y2, 10:30, 30m
```

`intervalsOverlap(aStart, aEnd, bStart, bEnd) = aStart < bEnd && bStart < aEnd`. Ko'chirishda (`PATCH`) tekshiruv **bronning o'zini hisobga olmaydi**.

---

## 7. Fayl yuklash oqimi (M6)

```mermaid
flowchart TD
    A["POST /users/me/avatar<br/>yoki /services/:id/image<br/>(multipart, field 'file')"] --> G{"JwtAuthGuard<br/>+ RolesGuard"}
    G -- "401 / 403" --> X["Diskda hech narsa yozilmaydi"]
    G -- ok --> M["Multer memoryStorage<br/>limits: 2 MB, files: 1"]
    M -- "> 2 MB" --> E413["413"]
    M -- "fayl yo'q / noto'g'ri field / 2+ fayl" --> E400a["400"]
    M -- ok --> P["ParseUUIDPipe (:id)"]
    P -- "noto'g'ri uuid" --> E400b["400"]
    P --> T{"detectImageType(buffer)<br/>magic bytes"}
    T -- "null (matn, SVG, bo'sh)" --> E400c["400"]
    T -- "png / jpeg / webp" --> S{"Xizmat mavjudmi?<br/>(faqat image)"}
    S -- yo'q --> E404["404"]
    S -- ha --> W["StorageService.save()<br/>nom = uuid + kengaytma (turdan)<br/>UPLOAD_DIR ichida"]
    W --> U["DB: avatarUrl / imageUrl yangilash"]
    U -- xato --> R["Yangi faylni o'chirish"]
    U -- ok --> D["Eski faylni o'chirish"]
    D --> OK["201 {avatarUrl | imageUrl}<br/>GET /uploads/&lt;uuid&gt;.ext → statik"]
```

---

## 8. Test milestone'lari va qatlamlar

```mermaid
flowchart LR
    M1["M1<br/>Services CRUD (xotira)<br/>Filter, Prefix"] --> M2["M2<br/>PostgreSQL, TypeORM<br/>Entity, Migration"]
    M2 --> M3["M3<br/>Auth: JWT, bcrypt<br/>JwtAuthGuard"]
    M3 --> M4["M4<br/>Bookings: overlap,<br/>race, state machine"]
    M4 --> M5["M5<br/>RBAC: RolesGuard<br/>Middleware, Interceptor, Pipe"]
    M5 --> M6["M6<br/>Upload: Multer,<br/>magic bytes, Storage"]
    M6 --> M7["M7<br/>Integratsiya,<br/>xavfsizlik"]
```

Har bir `test:mN` o'zidan oldingi barcha milestone testlarini ham ishga tushiradi (regressiya).
