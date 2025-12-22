# API CONTRACT — Abonasi (MVP)

Base URL: /api
Auth: JWT (Authorization: Bearer)

---

## 🔐 Auth

### POST /auth/register
Request:
{
  "email": "string",
  "password": "string",
  "name": "string"
}

Response:
{
  "id": "uuid",
  "email": "string",
  "name": "string"
}

---

### POST /auth/login
Request:
{
  "email": "string",
  "password": "string"
}

Response:
{
  "token": "jwt"
}

---

### GET /auth/me
Response:
{
  "id": "uuid",
  "email": "string",
  "name": "string"
}

---

## 📢 Ads

### POST /ads
Create draft ad.

Request:
{
  "title": "string",
  "description": "string",
  "price": number,
  "locationId": "uuid"
}

Response:
{
  "id": "uuid",
  "status": "draft"
}

---

### POST /ads/{id}/publish
Response:
{
  "status": "active",
  "publishedAt": "datetime"
}

---

### POST /ads/{id}/stop
Response:
{
  "status": "stopped"
}

---

### GET /ads/my
Response:
[
  {
    "id": "uuid",
    "title": "string",
    "status": "draft|active|stopped"
  }
]

---

### GET /ads?locationId=UUID
Public feed by district.

---

## 📍 Locations

### GET /locations
Response:
[
  {
    "id": "uuid",
    "country": "string",
    "city": "string",
    "district": "string"
  }
]
