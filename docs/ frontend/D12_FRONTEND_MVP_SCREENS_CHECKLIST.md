# Abonasi Frontend MVP (D12)
📋 SCREENS CHECKLIST — экраны → API → состояние → действия

Документ используется как пошаговый план реализации Frontend MVP.
Каждый экран = один файл в `pages/`.

---

## HomePage
**Назначение:** умный entry-point, без UI.

### Использует
- auth.store
- location.store

### Логика
- если нет token → redirect `/login`
- если есть token, но нет location → `/locations`
- если есть token и location → `/feed`

---

## LoginPage
**Назначение:** логин пользователя.

### API
- POST `/auth/login`
- GET `/auth/me`

### State
- email
- password
- loading
- error

### Actions
- submit → login
- success → save token → fetch me → redirect

---

## RegisterPage
**Назначение:** регистрация пользователя.

### API
- POST `/auth/register`
- GET `/auth/me`

### State
- email
- password
- name
- loading
- error

### Actions
- submit → register
- success → save token → fetch me → redirect

---

## LocationSelectPage
**Назначение:** выбор локации.

### API
- GET `/locations`

### State
- locations[]
- selectedLocationId
- loading
- error

### Actions
- select location
- confirm → save location → redirect `/feed`

---

## FeedPage
**Назначение:** публичный feed объявлений.

### API
- GET `/ads/feed?locationId=`

### State
- ads[]
- loading
- error

### Actions
- click ad → `/ads/:id`

---

## AdDetailsPage
**Назначение:** карточка объявления.

### API
- GET `/ads/:id`
- POST `/ads/:id/publish`
- POST `/ads/:id/stop`
- POST `/ads/:id/restart`

### State
- ad
- loading
- error

### Actions
- publish / stop / restart (если owner)
- go to photos (если draft)
- back to feed

---

## MyAdsPage
**Назначение:** объявления владельца.

### API
- GET `/ads/my`

### State
- ads[]
- loading
- error

### Actions
- new draft → `/draft/new`
- open ad → `/ads/:id`

---

## DraftCreatePage
**Назначение:** создание draft.

### API
- POST `/ads`

### State
- title
- description
- loading
- error

### Actions
- submit → create draft
- success → redirect `/draft/:id/photos`

---

## DraftPhotosPage
**Назначение:** управление фото draft.

### API
- POST `/ads/:id/photos`
- DELETE `/ads/:id/photos/:photoId`
- PATCH `/ads/:id/photos/reorder`
- POST `/ads/:id/publish`

### State
- photos[]
- uploading
- error

### Actions
- add photo
- delete photo
- reorder photos
- publish → `/ads/:id`
- back → `/my-ads`

---

## Принцип реализации
- все success-ответы читаются из `{ data }`
- все ошибки показываются через `ErrorBox`
- loading всегда явный
- никакого дизайна, только UX и логика

---

## Статус документа
📋 CHECKLIST — Frontend MVP D12  
Используется для реализации D12-FE-1 / D12-FE-2 / D12-FE-3
