#!/usr/bin/env bash
set -euo pipefail

# ------------------------------------------------------------
# Abonasi Client Smoke (D9)
# - register -> login -> create draft -> add photo -> publish
# - view public card -> versions timeline
#
# Requires:
# - backend running locally (default http://localhost:3001)
# - jq installed
#
# Usage:
#   bash docs/client-smoke.sh
#   API_BASE=http://localhost:3001 bash docs/client-smoke.sh
# ------------------------------------------------------------

API_BASE="${API_BASE:-http://localhost:3001}"

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[smoke] missing dependency: $1"
    exit 1
  }
}

need curl
need jq

STAMP="$(date +%s)"
EMAIL="smoke_${STAMP}@example.com"
PASSWORD="password123"
NAME="Smoke User ${STAMP}"

echo "[smoke] API_BASE=${API_BASE}"
echo "[smoke] EMAIL=${EMAIL}"

json() { jq -c '.'; }

post_json() {
  local url="$1"
  local token="${2:-}"
  local body="${3:-{}}"

  if [[ -n "${token}" ]]; then
    curl -sS -X POST "${API_BASE}${url}" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${token}" \
      -d "${body}"
  else
    curl -sS -X POST "${API_BASE}${url}" \
      -H "Content-Type: application/json" \
      -d "${body}"
  fi
}

patch_json() {
  local url="$1"
  local token="$2"
  local body="${3:-{}}"

  curl -sS -X PATCH "${API_BASE}${url}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${token}" \
    -d "${body}"
}

get_json() {
  local url="$1"
  local token="${2:-}"

  if [[ -n "${token}" ]]; then
    curl -sS "${API_BASE}${url}" -H "Authorization: Bearer ${token}"
  else
    curl -sS "${API_BASE}${url}"
  fi
}

# ----------------------------
# 1) register
# ----------------------------
echo
echo "[1] register"
REG="$(post_json "/api/auth/register" "" "$(jq -n \
  --arg email "$EMAIL" \
  --arg password "$PASSWORD" \
  --arg name "$NAME" \
  '{email:$email, password:$password, name:$name}' \
)")"

echo "$REG" | jq '.'

# ----------------------------
# 2) login -> token
# ----------------------------
echo
echo "[2] login"
LOGIN="$(post_json "/api/auth/login" "" "$(jq -n \
  --arg email "$EMAIL" \
  --arg password "$PASSWORD" \
  '{email:$email, password:$password}' \
)")"

echo "$LOGIN" | jq '.'

TOKEN="$(echo "$LOGIN" | jq -r '.data.token // empty')"
if [[ -z "${TOKEN}" ]]; then
  echo "[smoke] ERROR: token not found in login response"
  exit 1
fi
echo "[smoke] token ok"

# ----------------------------
# 3) create draft
# ----------------------------
# NOTE: locationId depends on your DB seed.
# We try to take first location from GET /api/locations (public).
echo
echo "[3] resolve locationId"
LOCATIONS="$(get_json "/api/locations")"
LOCATION_ID="$(echo "$LOCATIONS" | jq -r '.data[0].id // .[0].id // empty')"
if [[ -z "${LOCATION_ID}" ]]; then
  echo "[smoke] ERROR: cannot resolve locationId from /api/locations"
  echo "$LOCATIONS" | jq '.'
  exit 1
fi
echo "[smoke] locationId=${LOCATION_ID}"

echo
echo "[4] create draft ad"
DRAFT="$(post_json "/api/ads" "$TOKEN" "$(jq -n \
  --arg locationId "$LOCATION_ID" \
  '{locationId:$locationId, title:"Smoke Ad", description:"Smoke desc", priceCents: 1234}' \
)")"

echo "$DRAFT" | jq '.'
AD_ID="$(echo "$DRAFT" | jq -r '.data.id // empty')"
if [[ -z "${AD_ID}" ]]; then
  echo "[smoke] ERROR: ad id not found"
  exit 1
fi
echo "[smoke] adId=${AD_ID}"

# ----------------------------
# 4) add photo to draft
# ----------------------------
# Based on current backend design: photos are stored in DB as file_path.
# This endpoint does NOT upload a binary, it attaches a "filePath".
# If you later switch to real uploads, adjust this step accordingly.
echo
echo "[5] add photo to draft"
ADD_PHOTO="$(post_json "/api/ads/${AD_ID}/photos" "$TOKEN" "$(jq -n \
  --arg filePath "uploads/smoke_${STAMP}.jpg" \
  '{filePath:$filePath}' \
)")"

echo "$ADD_PHOTO" | jq '.'

PHOTOS_COUNT="$(echo "$ADD_PHOTO" | jq -r '.data.photos | length // 0')"
if [[ "${PHOTOS_COUNT}" == "0" ]]; then
  echo "[smoke] ERROR: photo not attached (photos length is 0)"
  exit 1
fi
echo "[smoke] photos attached: ${PHOTOS_COUNT}"

# ----------------------------
# 5) publish
# ----------------------------
echo
echo "[6] publish"
PUBLISH="$(post_json "/api/ads/${AD_ID}/publish" "$TOKEN" "{}")"
echo "$PUBLISH" | jq '.'

STATUS="$(echo "$PUBLISH" | jq -r '.data.status // empty')"
if [[ "${STATUS}" != "active" ]]; then
  echo "[smoke] ERROR: expected published status=active, got: ${STATUS}"
  exit 1
fi
echo "[smoke] published ok"

# ----------------------------
# 6) public card (optionalAuth)
# ----------------------------
echo
echo "[7] get public card (no auth)"
CARD="$(get_json "/api/ads/${AD_ID}")"
echo "$CARD" | jq '.'

# ----------------------------
# 7) versions (optionalAuth)
# ----------------------------
echo
echo "[8] versions timeline (no auth)"
VERS="$(get_json "/api/ads/${AD_ID}/versions")"
echo "$VERS" | jq '.'

echo
echo "[smoke] ✅ done"
