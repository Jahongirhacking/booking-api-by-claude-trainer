# Booking API — Target Reference (end-of-project blueprint)

This is the **complete API as it should look when the project is finished**. Build toward it and tick endpoints off as you go.

Status legend: ✅ implemented · 🚧 planned

- Base URL: `http://localhost:3000`, all routes under `/api/v1` except `/health`.
- JSON bodies; strict validation (unknown fields → `400`).
- Auth header: `Authorization: Bearer <accessToken>` (JWT from login, payload `{ sub, email, role }`).
- Roles: `ADMIN`, `STAFF`, `CUSTOMER`. "Public" = no token needed.
- Booking statuses: `PENDING → CONFIRMED → COMPLETED`, or `CANCELLED`.

## Access matrix

| # | Method | Path | Access | Status | Purpose |
|---|--------|------|--------|--------|---------|
| 1 | GET | `/health` | Public | ✅ | Health check |
| 2 | POST | `/auth/register` | Public | ✅ | Register (always role `CUSTOMER`) |
| 3 | POST | `/auth/login` | Public | ✅ | Get access token |
| 4 | GET | `/auth/me` | Any logged-in | ✅ | Own profile |
| 5 | PATCH | `/auth/me` | Any logged-in | 🚧 | Update own name / image |
| 6 | PATCH | `/auth/me/password` | Any logged-in | 🚧 | Change own password |
| 7 | GET | `/users` | ADMIN | 🚧 | List users (filter, paginate) |
| 8 | GET | `/users/:id` | ADMIN | 🚧 | Get one user |
| 9 | PATCH | `/users/:id/role` | ADMIN | 🚧 | Change a user's role |
| 10 | DELETE | `/users/:id` | ADMIN | 🚧 | Delete user (blocked if they have bookings) |
| 11 | GET | `/services` | Public | 🚧 | List services |
| 12 | GET | `/services/:id` | Public | 🚧 | Get one service |
| 13 | POST | `/services` | ADMIN | 🚧 (stub exists, unguarded) | Create service |
| 14 | PATCH | `/services/:id` | ADMIN | 🚧 | Update service |
| 15 | DELETE | `/services/:id` | ADMIN | 🚧 | Delete service (blocked if bookings exist) |
| 16 | GET | `/staff` | Public | 🚧 | List active staff |
| 17 | GET | `/staff/:id` | Public | 🚧 | Get one staff member |
| 18 | POST | `/staff` | ADMIN | 🚧 | Turn a user into staff (sets role `STAFF`) |
| 19 | PATCH | `/staff/:id` | ADMIN | 🚧 | Update specialization / `isActive` |
| 20 | DELETE | `/staff/:id` | ADMIN | 🚧 | Remove staff profile (blocked if bookings) |
| 21 | GET | `/staff/:id/availability?date=` | Public | 🚧 | Free time slots for a day |
| 22 | POST | `/bookings` | CUSTOMER, ADMIN | 🚧 | Create a booking |
| 23 | GET | `/bookings` | Any logged-in (scoped) | 🚧 | List bookings |
| 24 | GET | `/bookings/:id` | Owner / assigned staff / ADMIN | 🚧 | Get one booking |
| 25 | PATCH | `/bookings/:id` | Owner (while `PENDING`) / ADMIN | 🚧 | Reschedule / edit notes |
| 26 | PATCH | `/bookings/:id/status` | See rules below | 🚧 | Confirm / complete / cancel |
| 27 | DELETE | `/bookings/:id` | ADMIN | 🚧 | Hard-delete a booking |

**Scoping of `GET /bookings`:** CUSTOMER sees own bookings · STAFF sees bookings assigned to them · ADMIN sees all.

**Status transition rules (`PATCH /bookings/:id/status`):**

| To | Who |
|----|-----|
| `CONFIRMED` | assigned STAFF, ADMIN |
| `COMPLETED` | assigned STAFF, ADMIN (only from `CONFIRMED`) |
| `CANCELLED` | booking owner (CUSTOMER), assigned STAFF, ADMIN (not once `COMPLETED`) |

---

## Health

### 1. `GET /health` ✅
```bash
curl http://localhost:3000/health
```
`200` → `{ "status": "ok", "success": true, "timestamp": 1760000000000 }`

---

## Auth

### 2. `POST /auth/register` ✅ — Public
Body: `email` (unique, valid), `password`, `fullName`.
```bash
curl -X POST localhost:3000/api/v1/auth/register -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"secret123","fullName":"John Doe"}'
```
`201` user without `passwordHash` · `400` validation · `409` email taken

### 3. `POST /auth/login` ✅ — Public
Body: `email`, `password`.
`201` → `{ "accessToken": "<jwt>" }` · `400` validation · `401` wrong credentials

### 4. `GET /auth/me` ✅ — Any logged-in
`200` profile · `401` bad/expired token · `404` user gone

### 5. `PATCH /auth/me` 🚧 — Any logged-in
Body (all optional): `fullName`, `imageUrl`. `200` updated profile · `400` · `401`

### 6. `PATCH /auth/me/password` 🚧 — Any logged-in
Body: `currentPassword`, `newPassword`. `204` · `400` · `401` (wrong current password)

---

## Users (admin only)

### 7. `GET /users` 🚧
Query: `role`, `search` (name/email), `page` (default 1), `limit` (default 20).
`200` → `{ "data": [...], "total": 42, "page": 1, "limit": 20 }` · `401` · `403`

### 8. `GET /users/:id` 🚧
`200` user · `401` · `403` · `404`

### 9. `PATCH /users/:id/role` 🚧
Body: `{ "role": "ADMIN" | "STAFF" | "CUSTOMER" }`. `200` · `400` · `401` · `403` · `404`

### 10. `DELETE /users/:id` 🚧
`204` · `401` · `403` · `404` · `409` (user has bookings — FK is `RESTRICT`)

---

## Services

### 11. `GET /services` 🚧 — Public
Query: `search`, `page`, `limit`. `200` paginated list.

### 12. `GET /services/:id` 🚧 — Public
`200` service · `404`

### 13. `POST /services` 🚧 — ADMIN (currently a stub with no guard/DB save)
Body: `name` (1–100, unique), `description?`, `durationMinutes` (5–480), `price` (≥ 0), `imageUrl?`.
```bash
curl -X POST localhost:3000/api/v1/services -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Haircut","durationMinutes":30,"price":25}'
```
`201` created · `400` · `401` · `403` · `409` name exists

### 14. `PATCH /services/:id` 🚧 — ADMIN
Body: any subset of the create fields. `200` · `400` · `401` · `403` · `404` · `409`

### 15. `DELETE /services/:id` 🚧 — ADMIN
`204` · `401` · `403` · `404` · `409` (has bookings)

---

## Staff

### 16. `GET /staff` 🚧 — Public
Query: `specialization`, `isActive` (default `true`; non-admins always get active only). `200` list with user `fullName`/`imageUrl`.

### 17. `GET /staff/:id` 🚧 — Public
`200` · `404`

### 18. `POST /staff` 🚧 — ADMIN
Body: `userId`, `specialization`. Sets that user's role to `STAFF`.
`201` · `400` · `401` · `403` · `404` user not found · `409` already staff

### 19. `PATCH /staff/:id` 🚧 — ADMIN
Body: `specialization?`, `isActive?`. `200` · `400` · `401` · `403` · `404`

### 20. `DELETE /staff/:id` 🚧 — ADMIN
`204` · `401` · `403` · `404` · `409` (has bookings — prefer `isActive: false`)

### 21. `GET /staff/:id/availability?date=2026-12-01&serviceId=<uuid>` 🚧 — Public
Returns free slots for that staff on that day, sized to the service duration (excludes `PENDING`/`CONFIRMED` bookings).
`200` → `{ "date": "2026-12-01", "slots": [{ "startTime": "...", "endTime": "..." }] }` · `400` · `404`

---

## Bookings

### 22. `POST /bookings` 🚧 — CUSTOMER, ADMIN
Body: `staffId`, `serviceId`, `startTime` (ISO 8601, future), `notes?` (≤ 500).
`endTime` is computed from the service duration; `customerId` comes from the token (ADMIN may pass `customerId`). Status starts `PENDING`.
```bash
curl -X POST localhost:3000/api/v1/bookings -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"staffId":"<uuid>","serviceId":"<uuid>","startTime":"2026-12-01T10:00:00Z","notes":"First visit"}'
```
`201` · `400` (past time) · `401` · `403` (STAFF can't book) · `404` staff/service · `409` slot already taken / staff inactive

### 23. `GET /bookings` 🚧 — Any logged-in (scoped)
Query: `status`, `staffId`, `serviceId`, `from`, `to`, `page`, `limit`. `200` paginated · `401`

### 24. `GET /bookings/:id` 🚧 — Owner / assigned staff / ADMIN
`200` (with customer, staff, service) · `401` · `403` · `404`

### 25. `PATCH /bookings/:id` 🚧 — Owner (only while `PENDING`) / ADMIN
Body: `startTime?`, `staffId?`, `notes?`. Recomputes `endTime`, re-checks conflicts.
`200` · `400` · `401` · `403` · `404` · `409`

### 26. `PATCH /bookings/:id/status` 🚧 — see transition rules
Body: `{ "status": "CONFIRMED" | "COMPLETED" | "CANCELLED" }`.
`200` · `400` · `401` · `403` · `404` · `409` (illegal transition)

### 27. `DELETE /bookings/:id` 🚧 — ADMIN
`204` · `401` · `403` · `404`

---

## Common error shape
```json
{ "statusCode": 403, "message": "Forbidden resource", "error": "Forbidden" }
```
`401` = no/invalid token · `403` = logged in but wrong role/not owner.

## What you need to build to get there
1. `@Roles(...)` decorator + `RolesGuard` (then apply `JwtAuthGuard` + `RolesGuard` on admin routes).
2. Public routes stay unguarded; no global guard is required.
3. Pagination DTO shared by all list endpoints.
4. Booking conflict check (overlap on `staffId` for `PENDING`/`CONFIRMED`) inside a transaction.
5. Replace the services stub with real persistence.
