# PROMPTS — библиотека шаблонов Codex

---

## 🧩 Универсальный шаблон

### 1) Goal
Коротко: что сделать и зачем.

### 2) Current behavior
Как сейчас работает или ломается.

### 3) Target behavior (Acceptance Criteria)
- пункт 1
- пункт 2
- пункт 3

### 4) Constraints (HARD)
- FILES TO TOUCH:
  - ...
- FILES NOT TO TOUCH:
  - everything else
- Do NOT reformat code
- Do NOT refactor unrelated logic
- Output: unified diff patch

### 5) Context
Только нужные куски кода / логи / схемы.

### 6) Output format
Return a unified diff patch + short explanation.

---

## 🐞 Промт: Минификс бага
Goal: Fix one specific bug without changing architecture.

Constraints:
- max 2 files
- no refactor
- patch only

---

## ➕ Промт: Новый API endpoint
Goal: Add one REST endpoint.

Requirements:
- route
- controller
- service (если есть)
- update API_CONTRACT.md

---

## 🗄️ Промт: Миграция БД
Goal: Add one database migration.

Requirements:
- one migration file
- backward compatible
- update DB schema docs

---

## 🧹 Промт: Ограниченный рефакторинг
Goal: Improve X based on concrete issue.

Constraints:
- max N lines
- no renaming public API
- explain why each change is needed
