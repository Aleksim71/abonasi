# Abonasi Backend — Checklist & Next Steps (MVP)

> Обновлено: 2025-12-24
> Репозиторий: `~/abonasi`
> API base: `http://localhost:3001/api`

---

## 0) Быстрый старт (каждый раз перед работой)

- [ ] `cd ~/abonasi/backend`
- [ ] `npm i`
- [ ] Запуск API: `npm run dev`
- [ ] Проверка health:
  - [ ] `curl -s http://localhost:3001/api/health`

---

## 1) Текущее состояние (СДЕЛАНО ✅)

### Git

- [x] Инициализирован репозиторий
- [x] Коммиты идут атомарно (feat / docs / test)
- [x] Теги: `v0.0.0-bootstrap`

### PostgreSQL

- [x] Создана БД `abonasi` и пользователь `abonasi_user`
- [x] Схема: `users`, `locations`, `ads`, `ad_photos`
- [x] Seed локаций загружен
- [x] Таблицы проверены через `\dt`
- [x] DB trigger `ads_prevent_update_non_draft`
- [x] Bypass через `SET LOCAL app.allow_non_draft_update='1'`

### Backend skeleton

- [x] Express + routes
- [x] Healthcheck `GET /api/health`
- [x] `.env.example`
- [x] Nodemon dev-run

### Auth (JWT)

- [x] `POST /api/auth/register`
- [x] `POST /api/auth/login`
- [x] `GET /api/auth/me`
- [x] `requireAuth` middleware
- [x] `optionalAuth` middleware

### Ads (MVP)

- [x] `POST /api/ads` → draft
- [x] `PATCH /api/ads/:id` → fork logic
- [x] `POST /api/ads/:id/publish`
- [x] `POST /api/ads/:id/stop`
- [x] `POST /api/ads/:id/restart`
- [x] `GET /api/ads/my`
- [x] `GET /api/ads?locationId=...`
- [x] `GET /api/ads/:id`
- [x] `GET /api/ads/:id/versions`
- [x] ad_photos CRUD + reorder
- [x] smoke_fork.sh

---

## 2) Smoke tests

- [ ] resolve locationId
- [ ] login → token
- [ ] create draft
- [ ] add photo
- [ ] publish
- [ ] fork active
- [ ] stop
- [ ] fork stopped
- [ ] versions timeline OK

---

## 3) Jest (integration)

### Setup

- [ ] jest
- [ ] supertest
- [ ] test DB
- [ ] reset/seed helpers

### Tests

- [ ] ads.fork.int.test.js
- [ ] db.trigger.int.test.js

---

## 4) Backend improvements

- [ ] global error handler
- [ ] feed: exclude replaced active
- [ ] db schema/trigger sql in repo

---

## 5) Tags

- [x] v0.0.0-bootstrap
- [ ] v0.1.0-backend-mvp
