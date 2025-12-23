# Abonasi Backend — Checklist & Next Steps (MVP)

> Обновлено: 2025-12-23
> Репозиторий: ~/abonasi
> API base: http://localhost:3001/api

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
- [x] Коммиты идут атомарно
- [x] Теги: `v0.0.0-bootstrap` (есть)

### PostgreSQL

- [x] Создана БД `abonasi` и пользователь `abonasi_user`
- [x] Схема: users, locations, ads, ad_photos
- [x] Seed локаций загружен (Munich районы и т.д.)
- [x] Таблицы проверены через `\dt`

### Backend skeleton

- [x] Express + routes
- [x] DB healthcheck
- [x] .env.example, конфиг подключения к Postgres
- [x] Nodemon dev-run

### Locations module

- [x] `GET /api/locations` (фильтры country/city)
- [x] `GET /api/locations/countries`
- [x] `GET /api/locations/cities?country=...`
- [x] `GET /api/locations/districts?country=...&city=...`
- [x] `GET /api/locations/resolve?country=...&city=...&district=...` → возвращает locationId

### Auth module (JWT)

- [x] `POST /api/auth/register`
- [x] `POST /api/auth/login` → token
- [x] `GET /api/auth/me` (Bearer token)
- [x] Повторная регистрация → CONFLICT (ожидаемо)

### Ads MVP

- [x] `POST /api/ads` (создать draft, requires JWT)
- [x] `GET /api/ads/my` (requires JWT)
- [x] `POST /api/ads/:id/publish` (requires JWT)
- [x] `POST /api/ads/:id/stop` (requires JWT)
- [x] `GET /api/ads?locationId=...` (public feed, active only)
- [x] `PATCH /api/ads/:id` (requires JWT, только own + только draft)

---

## 2) Smoke-tests (быстрая проверка работоспособности)

### 2.1 Получить locationId

- [ ] `curl -s "http://localhost:3001/api/locations/resolve?country=Germany&city=Munich&district=Laim"`

### 2.2 Получить token

- [ ] `curl -s -X POST "http://localhost:3001/api/auth/login" -H "Content-Type: application/json" -d '{"email":"alex@example.com","password":"password123"}'`

### 2.3 Проверить me

- [ ] `curl -s "http://localhost:3001/api/auth/me" -H "Authorization: Bearer <TOKEN>"`

### 2.4 Ads: draft → patch → publish → feed

- [ ] `POST /api/ads` (draft)
- [ ] `PATCH /api/ads/:id` (draft only)
- [ ] `POST /api/ads/:id/publish`
- [ ] `GET /api/ads?locationId=...` (должно появиться)
- [ ] (опционально) `POST /api/ads/:id/stop`

---

## 3) Следующий шаг (выбираем направление)

### 3.1 Карточка объявления (рекомендуется первой)

- [ ] `GET /api/ads/:id` (public)
  - [ ] Вернуть объявление + location (country/city/district)
  - [ ] (опционально) вернуть список photos (пока пусто)

### 3.2 Фото объявлений (ad_photos)

- [ ] Upload (multer) → файл на диск (локально)
- [ ] `POST /api/ads/:id/photos` (requires JWT, owner only)
- [ ] `DELETE /api/ads/:id/photos/:photoId` (requires JWT)
- [ ] `PATCH /api/ads/:id/photos/reorder` (requires JWT)
- [ ] Нормализация file_path и раздача статики `/uploads`

### 3.3 Пагинация + total count

- [ ] Добавить `total` в feed и my (или отдельный endpoint)
- [ ] Стандартизировать limit/offset

### 3.4 Контракт API

- [ ] Обновить `docs/API_CONTRACT.md` под реальные ответы
- [ ] Добавить примеры curl для каждого endpoint
- [ ] (опционально) OpenAPI позже

---

## 4) Аудит и дисциплина (периодичность)

### Перед каждой сессией (2–3 мин)

- [ ] `git status` (чисто?)
- [ ] `npm test` (если появится)
- [ ] `npm run dev` + `GET /health`

### После каждого логического блока (5–10 мин)

- [ ] Smoke-tests по блоку
- [ ] Коммит атомарный, понятное сообщение
- [ ] Обновить `docs/CHANGELOG_DEV.md` (1–3 строки)

### Раз в неделю (если проект живой)

- [ ] `npm audit` (и не обновлять хаотично, только осознанно)
- [ ] Проверить .env / секреты (не закоммичены ли)
- [ ] Быстрый просмотр логов/ошибок в dev

---

## 5) Точки сохранения (теги)

- [ ] `v0.0.0-bootstrap` ✅
- [ ] (предложение) `v0.1.0-backend-mvp` после следующего шага (GET /ads/:id + photos plan)

---
