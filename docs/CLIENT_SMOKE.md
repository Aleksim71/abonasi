# Abonasi — Client Smoke Scenarios (D9)

This document defines **client-level smoke scenarios** (frontend/mobile).
Goal: quickly validate that the backend works end-to-end with stable UX and API contract.

These scenarios are intentionally minimal and map to the integration tests:
- ads publish rules
- ads fork workflow
- ads versions timeline UX
- auth login/me contract

---

## Preconditions

- Backend is running locally: `http://localhost:3001`
- `.env` / `.env.test` configured (DB reachable)
- Locations seeded (at least 1 location exists)
- `JWT_SECRET` is set on server

---

## Conventions

### Auth header
`Authorization: Bearer <TOKEN>`

### Success (2xx)
Response is JSON. Shape depends on endpoint.

### Error (non-2xx)
Response is JSON:
- `error`: string code (e.g. `BAD_REQUEST`, `UNAUTHORIZED`, `NOT_FOUND`, `CONFLICT`, `NOT_ALLOWED`)
- `message`: human-readable string

---

## Scenario 0 — Health check (optional)

**Request**
- `GET /api/health` (if exists)

**Expect**
- 200 OK

If your project doesn't have `/api/health`, skip this scenario.

---

## Scenario 1 — Register → Login → Me

### 1.1 Register
**Request**
- `POST /api/auth/register`
- body: `{ "email", "password", "name" }`

**Expect**
- 201 Created (or 200 OK)
- returns token (if registration logs in) OR just user object

### 1.2 Login
**Request**
- `POST /api/auth/login`
- body: `{ "email", "password" }`

**Expect**
- 200 OK
- returns `{ token, user }` (exact shape — see API_CONTRACT / FRONTEND_CONTRACT)

### 1.3 Me
**Request**
- `GET /api/auth/me`
- requires Bearer token

**Expect**
- 200 OK
- returns current user

### 1.4 Me without token
**Request**
- `GET /api/auth/me` without Authorization

**Expect**
- 401 UNAUTHORIZED

---

## Scenario 2 — Ads: create draft → publish requires photos

### 2.1 Create draft
**Request**
- `POST /api/ads`
- requires Bearer token
- minimal body includes `locationId` + whatever required by API

**Expect**
- 201 Created (or 200 OK)
- ad status is `draft`

### 2.2 Publish draft without photos
**Request**
- `POST /api/ads/:id/publish`

**Expect**
- 409 CONFLICT
- error contract stable (see API_CONTRACT)

---

## Scenario 3 — Ads: publish ok (with photos)

### 3.1 Upload/attach photo
Depending on API:
- `POST /api/ads/:id/photos` (multipart) OR
- `POST /api/photos` then link OR
- any photo attach endpoint described in API_CONTRACT

**Expect**
- 200/201

### 3.2 Publish ok
**Request**
- `POST /api/ads/:id/publish`

**Expect**
- 200 OK
- ad becomes `active`
- `publishedAt` is set
- contract stable (no surprises in response shape)

---

## Scenario 4 — Ads: fork workflow (active → fork active; stopped → fork stopped)

This scenario mirrors integration: draft -> publish -> fork active -> stop -> fork stopped -> versions timeline

### 4.1 Fork active
**Request**
- `POST /api/ads/:id/fork`

**Expect**
- 200 OK (or 201)
- returns new draft ad id (replacement)

### 4.2 Stop old active
**Request**
- `POST /api/ads/:id/stop`

**Expect**
- 200 OK
- status becomes `stopped`

### 4.3 Fork stopped
**Request**
- `POST /api/ads/:id/fork` (where old is stopped)

**Expect**
- 200 OK (or 201)
- returns new draft ad id (replacement)

### 4.4 Negative checks
- stop draft -> 409
- stop non-owner -> 404
- fork when already replaced -> 409

---

## Scenario 5 — Ads: restart UX

### 5.1 Restart stopped (not replaced)
**Request**
- `POST /api/ads/:id/restart`

**Expect**
- 200 OK
- becomes `active`
- `stoppedAt` cleared
- stable response shape

### 5.2 Restart draft
**Expect**
- 409 CONFLICT (contract stable)

### 5.3 Restart active
**Expect**
- 409 CONFLICT (contract stable)

---

## Scenario 6 — Versions timeline UX (owner vs non-owner)

### 6.1 Owner versions
**Request**
- `GET /api/ads/:id/versions` with owner token

**Expect**
- 200 OK
- timeline contains markers:
  - `latestPublishedAdId`
  - `currentPublishedAdId`
(see API_CONTRACT / test description)

### 6.2 Non-owner versions
**Request**
- same endpoint but with another user token (or without token if allowed)

**Expect**
- allowed only for `active`
- must not leak `draft` / `stopped` items
- if ad is non-active -> 404

---

## Acceptance criteria (D9 done)

- Scenarios cover: auth + ads lifecycle + versions UX.
- Each scenario has: request + expectation (status + key contract points).
- Runnable script exists (docs/client-smoke.sh) for local validation.
