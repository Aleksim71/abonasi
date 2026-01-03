# Abonasi API Contract (v1)

This document defines the **public HTTP API contract** of the Abonasi backend.
It is the single source of truth for frontend and mobile clients.

---

## Goals

- Stable API for frontend & mobile apps
- Predictable error handling
- Backward compatibility inside v1
- Alignment with integration tests

---

## 1. Conventions

### Base URL
/api

### Content-Type
- Requests: application/json
- Responses: application/json

---

## 2. Response Format

### Success (2xx)

```json
{
  "ok": true,
  "data": {}
}
```

### Error (non-2xx)

```json
{
  "error": "ERROR_CODE",
  "message": "Human readable message"
}
```

---

## 3. ERROR_CODES

BAD_REQUEST  
UNAUTHORIZED  
NOT_FOUND  
NOT_ALLOWED  
CONFLICT  
DB_ERROR  
INTERNAL_ERROR

---

## 4. Auth API

POST /api/auth/register  
POST /api/auth/login

---

## 5. Ads API

POST /api/ads  
POST /api/ads/:id/publish  
POST /api/ads/:id/stop  
POST /api/ads/:id/restart  
POST /api/ads/:id/fork  
GET /api/ads/my  
GET /api/ads/feed  
GET /api/ads/:id/versions

---

## 6. Locations API

GET /api/locations/countries  
GET /api/locations/cities  
GET /api/locations/districts  
GET /api/locations/resolve
