# Abonasi Backend — Client Smoke (D11)

Цель: за 2–5 минут проверить, что backend “живой” и контракт API совпадает с OpenAPI + Swagger UI.

## Endpoints (локально)

- Health: `GET /api/health`
- Swagger UI: `GET /docs`
- OpenAPI spec: `GET /openapi.yaml`

## Контракт ответов (важно)

- **Success**: `{ "data": ... }`
- **Error**: `{ "error": "STRING", "message": "STRING" }`

---

## 1) Быстрый smoke через curl (рекомендуемый)

### Требования

- `curl`, `jq`
- backend запущен (например: `cd backend && npm run dev`)

### Скрипт smoke

```bash
set -euo pipefail

BASE="${BASE:-http://localhost:3001}"
echo "BASE=$BASE"

echo "== health"
curl -s "$BASE/api/health" | jq .

echo "== register"
STAMP=$(date +%s)
EMAIL="smoke_${STAMP}@example.com"
PASS="password123"
NAME="Smoke User"

REGISTER_JSON=$(curl -s -X POST "$BASE/api/auth/register"   -H "Content-Type: application/json"   -d "{"email":"$EMAIL","password":"$PASS","name":"$NAME"}")

echo "$REGISTER_JSON" | jq .
TOKEN=$(echo "$REGISTER_JSON" | jq -r '.data.token // empty')

if [ -z "${TOKEN:-}" ]; then
  echo "[FAIL] TOKEN is empty. Register response does not contain token."
  exit 1
fi

echo "== /me (auth)"
curl -s "$BASE/api/auth/me"   -H "Authorization: Bearer $TOKEN" | jq .

echo "== pick locationId (db helper)"
LOCATION_ID=$(psqlabonasi_prod -Atc "select id from locations limit 1;")
echo "LOCATION_ID=$LOCATION_ID"

echo "== create draft ad"
CREATE_JSON=$(curl -s -X POST "$BASE/api/ads"   -H "Content-Type: application/json"   -H "Authorization: Bearer $TOKEN"   -d "{
    "locationId":"$LOCATION_ID",
    "title":"Smoke ad",
    "description":"Hello! This is a smoke test ad.",
    "priceCents": null
  }")

echo "$CREATE_JSON" | jq .
AD_ID=$(echo "$CREATE_JSON" | jq -r '.data.id // empty')
echo "AD_ID=$AD_ID"
```

---

## 2) Swagger UI smoke (Try it out)

1. Открой `http://localhost:3001/docs`
2. Нажми **Authorize** → `Bearer <JWT_TOKEN>`
3. Прогони endpoints по порядку (health → auth → ads lifecycle)

---

## Done

Если smoke проходит без ошибок — backend готов к frontend-интеграции.
