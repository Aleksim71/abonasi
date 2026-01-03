# Client smoke scenarios (D9)

This document describes a minimal “client-side” smoke flow for Abonasi.

The goal is to validate that a frontend/mobile client can:
- register/login
- create a draft ad
- attach at least one photo to the draft
- publish the ad
- read public card + versions timeline without auth

---

## Prerequisites

- Backend is running locally (default): `http://localhost:3001`
- DB is migrated/seeded so that `GET /api/locations` returns at least one location
- `jq` installed

---

## Run

From repo root:

```bash
bash docs/client-smoke.sh
```

Or with custom base URL:

```bash
API_BASE=http://localhost:3001 bash docs/client-smoke.sh
```

---

## Scenario steps (what script does)

1) **Register**
- `POST /api/auth/register`
- body: `{ email, password, name }`

2) **Login**
- `POST /api/auth/login`
- body: `{ email, password }`
- expects: `data.token`

3) **Resolve a location**
- `GET /api/locations`
- uses first location id as `locationId`

4) **Create draft**
- `POST /api/ads` (auth)
- body: `{ locationId, title, description, priceCents }`
- expects: `data.id` (adId)

5) **Attach photo to draft**
- `POST /api/ads/:id/photos` (auth)
- current design attaches a DB record with `filePath` (no binary upload):
  - body: `{ filePath: "uploads/<something>.jpg" }`
- expects: `data.photos.length >= 1`

6) **Publish**
- `POST /api/ads/:id/publish` (auth)
- expects: `data.status === "active"`

7) **Read public card**
- `GET /api/ads/:id` (optional auth, script calls without auth)

8) **Read versions timeline**
- `GET /api/ads/:id/versions` (optional auth, script calls without auth)

---

## Notes

- If later you implement real file uploads (multipart), update step (5) accordingly.
- If `/api/locations` response shape changes, adjust the jq path in `docs/client-smoke.sh`.
