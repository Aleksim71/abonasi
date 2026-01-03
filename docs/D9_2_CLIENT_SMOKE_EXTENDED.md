# D9.2 — Client smoke scenarios (extended)

This document is a **client-oriented smoke checklist** for quickly validating the backend
from a CLI (curl) or a thin client test runner.

- Target: **v1 HTTP API**
- Scope: **Auth + Ads + Photos + Lifecycle + Versions**
- Audience: frontend/mobile developers, QA, CI smoke job

> Assumptions:
> - Base URL: `http://localhost:3001`
> - JSON only
> - Auth via `Authorization: Bearer <token>`
> - DB seeded with at least one `location` (or use your helper/seed process)

---

## 0) Quick setup (env vars)

```bash
export BASE_URL="http://localhost:3001"
export EMAIL="smoke_$(date +%s)@example.com"
export PASS="password123"
export NAME="Smoke User"
```

---

## 1) Auth: register → login → me

### 1.1 Register

```bash
curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{"email":"$EMAIL","password":"$PASS","name":"$NAME"}"
```

Expected:
- `200` or `201` (depending on implementation)
- Response has `data.token` (JWT) **or** you proceed to login.

### 1.2 Login

```bash
TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{"email":"$EMAIL","password":"$PASS"}" \
| node -pe "JSON.parse(fs.readFileSync(0,'utf8')).data.token")
echo "TOKEN=$TOKEN"
```

Expected:
- `200`
- `data.token` exists and is a non-empty string

### 1.3 Me

```bash
curl -s -X GET "$BASE_URL/api/auth/me" \
  -H "Authorization: Bearer $TOKEN"
```

Expected:
- `200`
- `data.user` exists (shape is backend-defined, but must at least contain `id`)

---

## 2) Locations: pick a locationId

Two options:

### 2.1 List existing locations

```bash
curl -s "$BASE_URL/api/locations" | head -c 400 && echo
```

Pick `locationId` (UUID) from the response.

### 2.2 If you have a seed helper
Use your existing seed/helper (project-specific). The smoke assumes `locationId` exists.

Set:

```bash
export LOCATION_ID="<uuid>"
```

---

## 3) Ads: create draft → attach photos → reorder → publish

### 3.1 Create draft

```bash
AD_ID=$(curl -s -X POST "$BASE_URL/api/ads" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"locationId\": \"$LOCATION_ID\",
    \"title\": \"Test ad\",
    \"description\": \"Smoke draft\",
    \"priceCents\": 1000
  }" | node -pe "JSON.parse(fs.readFileSync(0,'utf8')).data.id")
echo "AD_ID=$AD_ID"
```

Expected:
- `200`
- `data.id` is UUID
- `data.status` is `draft`

### 3.2 List my ads (must include new draft)

```bash
curl -s "$BASE_URL/api/ads/my" \
  -H "Authorization: Bearer $TOKEN" | head -c 600 && echo
```

Expected:
- `200`
- Contains the newly created draft (by id)

### 3.3 Add photos to draft

Backend currently stores photos in `ad_photos` with a `file_path` string.
This endpoint is a **draft-only** operation.

Add 2 photos:

```bash
PHOTOS=$(curl -s -X POST "$BASE_URL/api/ads/$AD_ID/photos" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{ \"filePath\": \"/tmp/p1.jpg\" }" \
| node -pe "JSON.stringify(JSON.parse(fs.readFileSync(0,'utf8')).data.photos)")
echo "$PHOTOS"

PHOTOS=$(curl -s -X POST "$BASE_URL/api/ads/$AD_ID/photos" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{ \"filePath\": \"/tmp/p2.jpg\" }" \
| node -pe "JSON.stringify(JSON.parse(fs.readFileSync(0,'utf8')).data.photos)")
echo "$PHOTOS"
```

Expected:
- `200`
- `data.adId == AD_ID`
- `data.photos` is an array, length increments
- Each photo has `id` (uuid) and `filePath`

Extract photo ids:

```bash
P1=$(echo "$PHOTOS" | node -pe "JSON.parse(fs.readFileSync(0,'utf8'))[0].id")
P2=$(echo "$PHOTOS" | node -pe "JSON.parse(fs.readFileSync(0,'utf8'))[1].id")
echo "P1=$P1"
echo "P2=$P2"
```

### 3.4 Reorder photos

```bash
curl -s -X PATCH "$BASE_URL/api/ads/$AD_ID/photos/reorder" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{ \"photoIds\": [\"$P2\", \"$P1\"] }"
```

Expected:
- `200`
- `data.photos[0].id == P2`

### 3.5 Publish (draft -> active)

```bash
curl -s -X POST "$BASE_URL/api/ads/$AD_ID/publish" \
  -H "Authorization: Bearer $TOKEN"
```

Expected:
- `200`
- `data.status == "active"`
- `data.publishedAt` is set (string timestamp)
- Publishing **must fail** if draft has 0 photos (see negative tests below)

---

## 4) Public read: get card + feed

### 4.1 Public ad card (optional auth)

```bash
curl -s "$BASE_URL/api/ads/$AD_ID" | head -c 600 && echo
```

Expected:
- `200`
- Contains:
  - `data.id == AD_ID`
  - `data.status == "active"`
  - `data.photos` array (or `photosCount` + `previewPhoto`, depending on endpoint contract)

### 4.2 Feed (optional auth)

```bash
curl -s "$BASE_URL/api/ads/feed" | head -c 900 && echo
```

Expected:
- `200`
- Only `active` ads are visible to non-owners
- Should include published ad (unless location filters exist and exclude it)

---

## 5) Lifecycle: stop → restart → versions timeline

### 5.1 Stop (active -> stopped)

```bash
curl -s -X POST "$BASE_URL/api/ads/$AD_ID/stop" \
  -H "Authorization: Bearer $TOKEN"
```

Expected:
- `200`
- `data.status == "stopped"`
- `data.stoppedAt` is set

### 5.2 Restart (stopped -> active)

```bash
curl -s -X POST "$BASE_URL/api/ads/$AD_ID/restart" \
  -H "Authorization: Bearer $TOKEN"
```

Expected:
- `200`
- `data.status == "active"`
- `data.stoppedAt` cleared (null/undefined)

### 5.3 Versions timeline (owner)

```bash
curl -s "$BASE_URL/api/ads/$AD_ID/versions" \
  -H "Authorization: Bearer $TOKEN" | head -c 1200 && echo
```

Expected:
- `200`
- Response includes `data.timeline` (or similar) with:
  - versions list
  - markers like `latestPublishedAdId` and `currentPublishedAdId` (per existing integration tests)

---

## 6) Fork scenario: create new version from active/stopped (non-draft update)

Fork is implemented as **PATCH** on a non-draft ad:
- old ad becomes replaced (points to new ad)
- new ad is created, copies photos, becomes current published (depending on rules)

### 6.1 Fork by updating an active ad

```bash
NEW_AD_ID=$(curl -s -X PATCH "$BASE_URL/api/ads/$AD_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{ \"title\": \"Forked title\", \"description\": \"Fork branch\", \"priceCents\": 1200 }" \
| node -pe "JSON.parse(fs.readFileSync(0,'utf8')).data.id")
echo "NEW_AD_ID=$NEW_AD_ID"
```

Expected:
- `200`
- `data.id != AD_ID` (new ad created)
- Old ad becomes replaced (server-specific fields; but non-owner must not see old ad anymore)

### 6.2 Versions on the *new* ad

```bash
curl -s "$BASE_URL/api/ads/$NEW_AD_ID/versions" \
  -H "Authorization: Bearer $TOKEN" | head -c 1400 && echo
```

Expected:
- `200`
- Timeline contains both ids (old and new) with correct markers

### 6.3 Non-owner visibility rules (optional auth / none)

Old ad should behave according to rules:
- non-owner must not see draft/stopped
- non-owner must get `404` for non-active ads (per tests)

Check old ad card without auth:

```bash
curl -i -s "$BASE_URL/api/ads/$AD_ID" | head -n 30
```

Expected (one of acceptable outcomes depending on current rules):
- `404` for replaced/non-current
- OR a safe redirection shape (but must not leak owner-only fields)

---

## 7) Negative contract checks (must be stable)

### 7.1 Missing Bearer token

```bash
curl -i -s "$BASE_URL/api/ads/my" | head -n 40
```

Expected:
- `401`
- JSON error shape: `{ "error": "UNAUTHORIZED", "message": "..." }`

### 7.2 Invalid token

```bash
curl -i -s "$BASE_URL/api/ads/my" \
  -H "Authorization: Bearer invalid.token.here" | head -n 40
```

Expected:
- `401`
- `{ "error": "UNAUTHORIZED", "message": "Invalid token" }`

### 7.3 Publish without photos

Create a new draft and publish immediately.

Expected:
- `409`
- Error shape aligned with the unified contract (see API_CONTRACT.md)

### 7.4 Restart draft

Expected:
- `409`
- Stable error shape (per integration tests)

### 7.5 Fork when photos count is 0

If you attempt to fork a non-draft ad that has no photos:
- expected: `409` / `NOT_ALLOWED` (rule-defined)
- stable error contract

---

## 8) Suggested CI smoke job (optional)

Minimal run:
- Auth: register/login/me
- Draft: create + addPhoto + publish
- Stop + restart
- Fork + versions
- A couple negative checks (401 + invalid token)

This can be implemented as:
- a bash script using curl + node JSON parsing
- or a tiny Node smoke runner

---

## Notes for client implementers

- Treat `error` as **machine code** and `message` as human-readable.
- For `401 UNAUTHORIZED`, client should:
  - clear session token
  - redirect to login
- For `409` business rule errors, show a neutral UX message and refresh current ad state.

