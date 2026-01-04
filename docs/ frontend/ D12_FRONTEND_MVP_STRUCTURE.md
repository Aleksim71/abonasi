# Abonasi Frontend MVP (D12)

🧭 ЯКОРЬ — структура папок + роуты (1 экран = 1 файл)

## Статус

Документ фиксирует архитектурный контракт Frontend MVP.
Используется как точка синхронизации backend ↔ frontend.
Изменяется только осознанно.

---

## Стек (зафиксирован)

- Vite
- React + TypeScript
- fetch (без axios)
- JWT → localStorage
- SPA
- frontend/ как отдельная папка

---

## Структура frontend/src

```text
src/
  app/
    App.tsx                 # корневой layout + RouterOutlet
    router.tsx              # все маршруты приложения
    guards.tsx              # RequireAuth / RequireLocation
  api/
    http.ts                 # fetch wrapper + baseUrl + JSON + error handling
    auth.api.ts             # register / login / me
    locations.api.ts        # list locations
    ads.api.ts              # feed / getById / myAds / createDraft / publish / stop / restart / photos
  store/
    auth.store.ts           # token + user + методы set/clear
    location.store.ts       # выбранная location + методы set/clear
  pages/
    HomePage.tsx            # умный редирект (entry point)
    LoginPage.tsx
    RegisterPage.tsx
    LocationSelectPage.tsx
    FeedPage.tsx
    AdDetailsPage.tsx
    MyAdsPage.tsx
    DraftCreatePage.tsx     # создание draft
    DraftPhotosPage.tsx     # add/delete/reorder photos
  ui/
    Layout.tsx              # минимальный каркас (header + main + nav)
    Loading.tsx
    ErrorBox.tsx
  utils/
    storage.ts              # helpers для localStorage
    format.ts               # мелкие форматтеры (опционально)
  main.tsx                  # bootstrap React
```

**Принцип:**

- `pages/*` — только экраны
- `api/*` — только HTTP
- `store/*` — состояние
- никакой бизнес-логики в UI-компонентах

---

## Роуты (SPA)

### Public

- `/login` → LoginPage
- `/register` → RegisterPage

### Protected (нужен JWT)

- `/locations` → LocationSelectPage
- `/feed` → FeedPage
- `/ads/:id` → AdDetailsPage
- `/my-ads` → MyAdsPage
- `/draft/new` → DraftCreatePage
- `/draft/:id/photos` → DraftPhotosPage

### Root

- `/` → HomePage (умный редирект)

---

## Guards (правила доступа)

### RequireAuth

- если нет token → redirect `/login`

### RequireLocation

- если нет выбранной location → redirect `/locations`

---

## Навигационная логика (UX)

### Entry

- `/`
  - нет token → `/login`
  - есть token, но нет location → `/locations`
  - есть token и location → `/feed`

### Auth

- Login / Register (success):
  - сохранить token
  - вызвать `me`
  - если нет location → `/locations`
  - если есть location → `/feed`

### Location

- выбор location → сохранить → `/feed`

### Feed

- клик по карточке → `/ads/:id`

### Ad Details

- если объявление принадлежит пользователю:
  - показать действия publish / stop / restart
  - если draft → ссылка `/draft/:id/photos`
- back → `/feed`

### My Ads

- список моих объявлений
- кнопка “New draft” → `/draft/new`
- клик по объявлению → `/ads/:id`

### Draft Create

- success → redirect `/draft/:id/photos`
- optional skip → `/my-ads`

### Draft Photos

- add / delete / reorder
- Publish → `/ads/:id`
- Back → `/my-ads`

---

## LocalStorage (минимум)

- `token`
- `locationId`

---

## Статус документа

🧭 ЯКОРЬ — Frontend MVP D12
Используется для реализации D12-FE-1 / D12-FE-2 / D12-FE-3
