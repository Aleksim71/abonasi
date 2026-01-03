# Abonasi Frontend / Client Contract (D8, v1)

This document defines how **clients (mobile/web)** interact with Abonasi backend API.
It complements `docs/API_CONTRACT.md`:
- `API_CONTRACT.md` = public HTTP API contract (format + endpoints)
- `FRONTEND_CONTRACT.md` = client behavior, flows, screens-to-API mapping, UX rules

---

## 0. Scope

**In scope**
- Auth flows (register/login/me)
- Ads flows: create draft → upload photos → publish → stop → restart → fork
- Ads versions timeline UX
- Locations list + filters
- Error handling rules for the client
- Security / token storage rules (client-side)

**Out of scope**
- UI design, layout, styling
- Payments / billing (future)
- Push notifications (future)
- Admin tools (future)

---

## 1. Base URL & Versioning

- Base URL: `/api`
- Contract version: **v1**
- Backward compatibility rule: v1 keeps response shapes stable; new fields may be added, but existing fields must not change meaning.

---

## 2. Response shapes (client must rely on these)

See `docs/API_CONTRACT.md` for full details.

### 2.1 Success (2xx)

- `ok` is always `true`
- `data` is endpoint-specific

### 2.2 Error (non-2xx)

Client must treat any non-2xx as error and parse:
- `error` (string code)
- `message` (human-readable)
- optional details (if present)

**Client UI uses `error` for branching**, not `message`.

---

## 3. Authentication

### 3.1 Token type

- Bearer JWT token in `Authorization` header:
  - `Authorization: Bearer <token>`

### 3.2 Token storage

**Mobile**: Secure storage (Keychain/Keystore).  
**Web**: Prefer memory + refresh strategy (future). If no refresh exists, keep token in memory and allow re-login.

Avoid localStorage if possible (XSS risk). If used, treat as MVP-only.

### 3.3 Auth states

- **Unauthenticated**: no token stored
- **Authenticated**: token present and `/api/auth/me` returns user
- **Expired/Invalid token**: any protected endpoint may return `401 UNAUTHORIZED`

### 3.4 Required client behavior on 401

If a protected request returns:
- `401 { error: "UNAUTHORIZED", ... }`

Client must:
1) clear token
2) route user to Login screen
3) show a neutral toast/snackbar: “Session expired. Please log in again.”

Do NOT retry protected requests automatically (to avoid loops).

---

## 4. Screens → API mapping (v1)

> Naming is conceptual. Your actual UI screen names may differ.
> The key is: what data each screen needs and what requests it triggers.

### 4.1 Screen: Country/City/District selection (Locations)

**Goal**: list locations for filters and ad creation.

- `GET /api/locations`
  - optional query:
    - `?country=Germany`
    - `?city=Munich`

**Client rules**
- Cache locations in memory for session (fast UX).
- If filters change (country/city), refetch.

---

### 4.2 Screen: Register

- `POST /api/auth/register`
  - body: `{ email, password, name }`
- success: returns token + user (see API_CONTRACT)

**Client rules**
- Validate email format + password length locally (fast feedback), but still handle server errors.
- On success:
  - store token
  - go to “My Ads” (or Home, depending on app structure)

---

### 4.3 Screen: Login

- `POST /api/auth/login`
  - body: `{ email, password }`

**Client rules**
- On success: store token, route to “My Ads”
- On error:
  - show “Invalid email or password” if server error indicates auth failure
  - otherwise generic error toast

---

### 4.4 Screen: Me (profile badge / header)

- `GET /api/auth/me` (requires Bearer token)

**Client rules**
- Called on app start if token exists.
- If fails with 401: clear token, route to Login.

---

## 5. Ads lifecycle UX contract (high-level)

The backend rules are enforced by tests; client must implement predictable UX.

### 5.1 Status vocabulary

Ads statuses (v1):
- `draft`
- `active`
- `stopped`

> Client must display status labels and use them to enable/disable actions.

### 5.2 Core flows

#### A) Create draft
- `POST /api/ads` (auth required)
- success returns ad (draft)

Client:
- route to “Edit Draft” screen

#### B) Upload photos
(Endpoint depends on your backend implementation; use `API_CONTRACT.md`.)

Client:
- must track photo upload progress
- must not allow publish until at least 1 photo exists (server will still enforce)

#### C) Publish
- `POST /api/ads/:id/publish` (auth required)

Client:
- On success: show “Published” and route to “My Ads” (or ad details)

#### D) Stop
- `POST /api/ads/:id/stop` (auth required)

Client:
- if server returns conflict (rule) → show explanation toast (“You can’t stop a draft.” etc.)
- if 404 for non-owner → show “Not found” / “Ad not available”

#### E) Restart
- `POST /api/ads/:id/restart` (auth required)

Client:
- if conflict due to rule: show reason and keep state unchanged

#### F) Fork (copy ad)
- `POST /api/ads/:id/fork` (auth required)

Client:
- On success: new ad draft created (or other shape) — route to edit

---

## 6. Ads versions timeline UX (owner vs non-owner)

There is a dedicated integration test suite validating this behavior.

### 6.1 Screen: Versions timeline

Endpoint: (see `API_CONTRACT.md` for exact URL)

**Owner behavior**
- timeline includes markers:
  - `latestPublishedAdId`
  - `currentPublishedAdId`
- owner may see full versioning history (including non-active states if allowed by backend)

**Non-owner behavior**
- allowed only for `active` ads
- must NOT leak draft/stopped versions
- for non-active ad: server returns 404 (treat as not available)

Client rules:
- If 404 on versions for non-owner:
  - show “This ad is not available”
  - route back to safe screen (search results / district feed)

---

## 7. Client error handling matrix (must follow)

### 7.1 General

- non-2xx => error
- Use `error` code for logic
- Use `message` for display only (may change wording)

### 7.2 Common status behaviors

**400 BAD_REQUEST**
- show inline validation error if field-specific
- otherwise toast “Invalid request”

**401 UNAUTHORIZED**
- clear token
- route to Login
- toast: “Session expired…”

**403 FORBIDDEN** (if ever used)
- show “No permission”

**404 NOT_FOUND**
- treat as “resource not available”
- if it was expected (e.g. non-owner actions): show friendly message

**409 CONFLICT**
- business rule violation
- show message from server as user-friendly explanation

**500 INTERNAL / DB_ERROR**
- show generic “Something went wrong. Try again.”
- allow retry

---

## 8. Optional auth endpoints / public screens

Some endpoints may support optional auth:
- client may call them with or without token
- if token invalid, backend should behave as anonymous

Client rule:
- If you include token and get 401 for an optional endpoint:
  - treat as token invalid, clear token, re-auth (same as protected)

---

## 9. Client networking rules

- Always set `Content-Type: application/json` for JSON bodies
- Always use request timeout (e.g. 15s)
- Retry policy:
  - retry only idempotent GETs (1 retry) on network timeouts
  - do not retry POST lifecycle actions automatically

- Correlation IDs (future):
  - If backend starts returning request IDs, client should log and include in bug reports.

---

## 10. Minimal QA checklist (client)

Before shipping MVP client, verify:
- Login/Register works end-to-end
- Token persists and `/auth/me` restores session
- Draft → photo upload → publish works
- Stop/Restart/Fork enforce business rules (409)
- Versions timeline works for owner and non-owner (no leaks)
- 401 handling clears token + routes to login
- App works with empty state (no ads, no photos)
