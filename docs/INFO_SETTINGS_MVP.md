# Info / Settings screen — MVP spec

Project: **Abonasi**  
Scope: **Info / Settings screen (single route, conditional content: guest vs authorized)**  
Owner: Alex (Oleksandr)  
Date: **2026-02-10**  
Branch: `feat/frontend-header-auth-settings`

---

## Goal

Create one screen that serves as:

- **Info / About** (trust + basic understanding)
- **Account entry point** for authorized users (minimal controls)
- **Login/Register entry point** for guests

The screen must be **simple, readable, and stable** (no “future” settings in MVP).

---

## Route & access

- Route: `GET /info` (frontend route)
- Access: **public** (available to guests)
- Visibility rules:
  - **Guest**: show Info blocks + “You are browsing as a guest” + Login/Register buttons
  - **Authorized**: show Info blocks + Account block (email/location) + My Ads + Logout

One route. One screen. Conditional rendering only.

---

## Screen structure (MVP)

### Header

- Title: `Info / Settings`
- Back button: `history.back()` (or app-level back navigation)
- Uses the standard Abonasi header layout

### Content sections (common for all)

1. **About Abonasi**
2. **How it works**
3. **Legal**
4. **Contact**

### Conditional section

- If **authorized**: `Account`
- Else **guest**: `Guest CTA`

---

## Content (exact MVP copy)

### 1) About Abonasi

Short paragraph:

> Abonasi is a local classifieds board for neighborhoods and cities.  
> Simple ads. No noise. No algorithms.

Optional small rows (if data exists):

- **App version**: `v0.x` (static build-time string is fine)
- **Current location**: city name if selected; otherwise `Not selected`

### 2) How it works

Bullets:

- Choose your city
- Create and publish an ad
- People nearby can view it

### 3) Legal

Links (placeholders allowed in MVP):

- Terms of Service → `/legal/terms`
- Privacy Policy → `/legal/privacy`
- Imprint → `/legal/imprint`

If legal pages are not implemented yet, route them to `/legal/placeholder` and reuse a simple placeholder page.

### 4) Contact

- Support email: `support@abonasi.app` *(placeholder allowed)*
- “Report a problem” action:
  - Option A (MVP): `mailto:support@abonasi.app?subject=Abonasi%20bug%20report`
  - Option B: internal route `/support` (if you already have it)

---

## Conditional blocks

### Guest (not authorized)

Text:

> You are browsing as a guest.

Buttons:

- `Log in` → `/login`
- `Register` → `/register`

No other settings.

### Authorized

#### Account summary

Show read-only rows:

- Email: `viewer.email`
- Location: `viewer.location` (or chosen location label)

Actions:

- `My Ads` → `/my-ads`
- `Logout` → triggers logout flow, then redirects to `/` or `/login`

No profile editing in MVP.

---

## Data contract (minimal)

```ts
type Viewer = {
  isAuth: boolean;
  email?: string;
  location?: string;
};
```

Source of truth: existing auth state in the app (store/context).

No additional API calls required for MVP, except the existing logout endpoint if already implemented.

---

## UX & UI rules

- Single-column layout
- Prefer headings + text + simple button rows
- No complex cards, toggles, advanced settings
- Use existing Abonasi spacing/tokens (same rhythm as Feed/Draft)
- Keep content readable on mobile (max width container)

Empty states:

- If no location is selected: show `Location: Not selected` (no additional prompt required)

---

## Non-goals (explicitly out of MVP)

Do **not** implement in this step:

- Change password
- Notification settings
- Language/theme switch
- Delete account
- Avatar/profile editing
- Analytics/telemetry toggles

These can be planned for v2.

---

## Acceptance checklist

- [ ] `/info` route exists and is reachable from header auth icon/menu
- [ ] Screen renders for guests and authorized users
- [ ] Guest sees Login/Register actions
- [ ] Authorized user sees Account block + My Ads + Logout
- [ ] Legal links exist (placeholder is acceptable)
- [ ] No extra settings beyond MVP
- [ ] Visual style matches Abonasi foundation (spacing/typography)

---

## Next implementation tasks

1. Add route + page component: `InfoSettingsPage`
2. Add simple CSS page styles (page-scoped)
3. Wire conditional rendering from auth state
4. Implement Logout action + redirect
5. Add legal placeholder page/routes if missing
