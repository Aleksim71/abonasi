#!/usr/bin/env bash
set -euo pipefail

API="${API:-http://localhost:3001}"
LOC="${LOC:-eb377b4b-a2a9-418c-96cb-ec5da95f13cb}"

# ✅ по умолчанию ждём TOKEN из окружения: export TOKEN="..."
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFsZXhAZXhhbXBsZS5jb20iLCJuYW1lIjoiQWxleCIsImlhdCI6MTc2NjUzODE5MiwiZXhwIjoxNzY3MTQyOTkyLCJzdWIiOiI0ZTJmNDkxMi00NTE1LTQ2ODItYjZhNS1mMWI1NjIzZWE3ZTYifQ.YX2KPzmOQ8oL0wKC9Ytks0SaG77fl21vG06pUwf1ZVM"

fail() { echo "❌ $*" >&2; exit 1; }

need() {
  command -v "$1" >/dev/null 2>&1 || fail "missing command: $1"
}

need curl
need jq

auth() {
  [[ -n "${TOKEN}" ]] || fail "TOKEN is empty. Do: export TOKEN='...'"
  printf "Authorization: Bearer %s" "$TOKEN"
}

# curl_json METHOD URL [JSON_BODY]
# печатает JSON-body, валит скрипт если HTTP != 2xx
curl_json() {
  local method="$1"; shift
  local url="$1"; shift
  local body="${1:-}"

  local tmp
  tmp="$(mktemp)"
  local code

  if [[ -n "$body" ]]; then
    code=$(curl -sS -o "$tmp" -w '%{http_code}' -X "$method" "$url" \
      -H "$(auth)" -H "Content-Type: application/json" \
      -d "$body" || true)
  else
    code=$(curl -sS -o "$tmp" -w '%{http_code}' -X "$method" "$url" \
      -H "$(auth)" || true)
  fi

  local resp
  resp="$(cat "$tmp")"
  rm -f "$tmp"

  if [[ "$code" != 2* ]]; then
    echo "HTTP $code $method $url" >&2
    echo "$resp" | jq -C . 2>/dev/null || echo "$resp" >&2
    fail "request failed"
  fi

  echo "$resp"
}

echo "== A) create draft"
RESP=$(curl_json POST "$API/api/ads" \
  "{\"locationId\":\"$LOC\",\"title\":\"Smoke A\",\"description\":\"Smoke A description 1234567890\",\"priceCents\":1000}")
echo "$RESP" | jq
DRAFT_ID=$(echo "$RESP" | jq -r '.id')
[[ "$DRAFT_ID" != "null" && -n "$DRAFT_ID" ]] || fail "no DRAFT_ID"
echo "DRAFT_ID=$DRAFT_ID"

echo "== B) add photo to draft"
curl_json POST "$API/api/ads/$DRAFT_ID/photos" \
  '{"filePath":"uploads/smoke.jpg","sortOrder":0}' | jq

echo "== C) publish draft -> active"
PUB=$(curl_json POST "$API/api/ads/$DRAFT_ID/publish")
echo "$PUB" | jq '.id,.status,.published_at'
[[ "$(echo "$PUB" | jq -r '.status')" == "active" ]] || fail "publish did not set active"

echo "== D) PATCH active -> fork (new active + old stopped)"
PATCH=$(curl_json PATCH "$API/api/ads/$DRAFT_ID" \
  '{"title":"Smoke A (EDIT)","description":"Smoke A edited description 1234567890"}')
echo "$PATCH" | jq '.notice, {old:.data.oldAdId,new:.data.newAdId,newStatus:.data.newStatus}'
NEW_ACTIVE_ID=$(echo "$PATCH" | jq -r '.data.newAdId')
[[ -n "$NEW_ACTIVE_ID" && "$NEW_ACTIVE_ID" != "null" ]] || fail "no NEW_ACTIVE_ID"
echo "NEW_ACTIVE_ID=$NEW_ACTIVE_ID"

echo "== E) check old is stopped and linked"
OLD=$(curl_json GET "$API/api/ads/$DRAFT_ID")
echo "$OLD" | jq '.data.id,.data.status,.data.replaced_by_ad_id,.data.parent_ad_id'
[[ "$(echo "$OLD" | jq -r '.data.status')" == "stopped" ]] || fail "old is not stopped"
[[ "$(echo "$OLD" | jq -r '.data.replaced_by_ad_id')" == "$NEW_ACTIVE_ID" ]] || fail "old.replaced_by_ad_id mismatch"

echo "== F) check new is active, linked, has copied photos"
NEW=$(curl_json GET "$API/api/ads/$NEW_ACTIVE_ID")
echo "$NEW" | jq '.data.id,.data.status,.data.parent_ad_id,.data.replaced_by_ad_id, (.data.photos|length), .data.photos[0].filePath'
[[ "$(echo "$NEW" | jq -r '.data.status')" == "active" ]] || fail "new is not active"
[[ "$(echo "$NEW" | jq -r '.data.parent_ad_id')" == "$DRAFT_ID" ]] || fail "new.parent_ad_id mismatch"
[[ "$(echo "$NEW" | jq -r '.data.replaced_by_ad_id // empty')" == "" ]] || fail "new should not have replaced_by"
[[ "$(echo "$NEW" | jq -r '(.data.photos|length)')" -ge 1 ]] || fail "new has no photos"

echo "== G) stop new active"
STOP=$(curl_json POST "$API/api/ads/$NEW_ACTIVE_ID/stop")
echo "$STOP" | jq '.id,.status,.stopped_at'
[[ "$(echo "$STOP" | jq -r '.status')" == "stopped" ]] || fail "stop did not set stopped"

echo "== H) PATCH stopped -> fork (must create NEW DRAFT)"
PATCH2=$(curl_json PATCH "$API/api/ads/$NEW_ACTIVE_ID" \
  '{"title":"Stopped -> edit","description":"Stopped -> edit description 1234567890"}')
echo "$PATCH2" | jq '.notice, {old:.data.oldAdId,new:.data.newAdId,newStatus:.data.newStatus}'
NEW_DRAFT_ID=$(echo "$PATCH2" | jq -r '.data.newAdId')
[[ -n "$NEW_DRAFT_ID" && "$NEW_DRAFT_ID" != "null" ]] || fail "no NEW_DRAFT_ID"
echo "NEW_DRAFT_ID=$NEW_DRAFT_ID"

echo "== I) new draft is draft, linked, has copied photos"
D2=$(curl_json GET "$API/api/ads/$NEW_DRAFT_ID")
echo "$D2" | jq '.data.id,.data.status,.data.parent_ad_id,.data.replaced_by_ad_id, (.data.photos|length), .data.photos[0].filePath'
[[ "$(echo "$D2" | jq -r '.data.status')" == "draft" ]] || fail "expected draft, got $(echo "$D2" | jq -r '.data.status')"
[[ "$(echo "$D2" | jq -r '.data.parent_ad_id')" == "$NEW_ACTIVE_ID" ]] || fail "draft.parent_ad_id mismatch"
[[ "$(echo "$D2" | jq -r '(.data.photos|length)')" -ge 1 ]] || fail "draft has no photos"

echo "== DONE ✅"
