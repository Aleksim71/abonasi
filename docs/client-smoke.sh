#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3001}"

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing dependency: $1"; exit 1; }; }
need curl
need jq

echo "== Abonasi client smoke =="
echo "BASE_URL=$BASE_URL"
echo

stamp="$(date +%s)"
EMAIL="smoke_${stamp}@example.com"
PASS="password123"
NAME="Smoke User"

json() { jq -c .; }

req() {
  local method="$1"; shift
  local url="$1"; shift
  curl -sS -X "$method" "$BASE_URL$url" -H "Content-Type: application/json" "$@"
}

echo "1) register"
REG_RES="$(req POST /api/auth/register -d "$(jq -n --arg e "$EMAIL" --arg p "$PASS" --arg n "$NAME" '{email:$e,password:$p,name:$n}')" )"
echo "$REG_RES" | json
echo

echo "2) login"
LOGIN_RES="$(req POST /api/auth/login -d "$(jq -n --arg e "$EMAIL" --arg p "$PASS" '{email:$e,password:$p}')" )"
echo "$LOGIN_RES" | json
TOKEN="$(echo "$LOGIN_RES" | jq -r '.token // empty')"
if [[ -z "${TOKEN}" || "${TOKEN}" == "null" ]]; then
  echo "ERROR: token not found in login response"
  exit 1
fi
AUTH=(-H "Authorization: Bearer $TOKEN")
echo

echo "3) me"
ME_RES="$(req GET /api/auth/me "${AUTH[@]}")"
echo "$ME_RES" | json
echo

echo "4) list locations (take first id)"
LOC_RES="$(req GET /api/locations)"
LOCATION_ID="$(echo "$LOC_RES" | jq -r '.[0].id // empty')"
if [[ -z "${LOCATION_ID}" || "${LOCATION_ID}" == "null" ]]; then
  echo "ERROR: no locations found. Ensure locations are seeded."
  exit 1
fi
echo "locationId=$LOCATION_ID"
echo

echo "5) create draft ad"
CREATE_RES="$(req POST /api/ads "${AUTH[@]}" -d "$(jq -n --arg loc "$LOCATION_ID" '{locationId:$loc,title:"Smoke ad",description:"Smoke desc",priceCents:0}')" )"
echo "$CREATE_RES" | json
AD_ID="$(echo "$CREATE_RES" | jq -r '.id // .data.id // empty')"
if [[ -z "${AD_ID}" || "${AD_ID}" == "null" ]]; then
  # fallback: maybe response is full ad object
  AD_ID="$(echo "$CREATE_RES" | jq -r '.id // empty')"
fi
if [[ -z "${AD_ID}" || "${AD_ID}" == "null" ]]; then
  echo "ERROR: cannot extract ad id from create response"
  exit 1
fi
echo "adId=$AD_ID"
echo

echo "6) publish without photos (expect 409)"
set +e
PUB_NO_PHOTO_HTTP="$(curl -sS -o /tmp/pub_no_photo.json -w "%{http_code}" -X POST "$BASE_URL/api/ads/$AD_ID/publish" "${AUTH[@]}" -H "Content-Type: application/json")"
set -e
cat /tmp/pub_no_photo.json | json
echo "HTTP=$PUB_NO_PHOTO_HTTP"
if [[ "$PUB_NO_PHOTO_HTTP" != "409" ]]; then
  echo "ERROR: expected 409 for publish without photos"
  exit 1
fi
echo

echo "NOTE: Photo upload endpoint differs by project setup."
echo "If you have /api/ads/:id/photos, implement it here and re-run."
echo "For now, smoke stops here after verifying core contract path."
echo
echo "OK ✅"
