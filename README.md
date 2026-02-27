# Elitearn — Уеб платформа за онлайн курсове (Frontend + Backend + Email Worker)

Elitearn е full‑stack уеб платформа за **публикуване, продажба и закупуване на онлайн курсове**.
Проектът е реализиран като **3 процеса**:

- **Frontend**: React + TypeScript (Vite)
- **Backend API**: Node.js + Express
- **Email Worker**: отделен Node процес (outbox pattern)

Автор: **Людмила Пулова**  
Курс: **Системи за е‑бизнес 2025/2026**

---

## 1) Какво може приложението

### Акаунти и сигурност
- Регистрация/вход (buyer/creator)
- JWT базирана автентикация
- Профил с данни (име, телефон, адрес, държава/град)
- Смяна на парола
- Изтриване на акаунт (с потвърждение с парола)

### Профилна снимка (Avatar)
- Качване на снимка от **Настройки**
- **Премахване** е налично **само ако вече има качена снимка**
- Преглед на снимката: клик върху кръглия аватар (отваря модал)
- В **чат** разговорите се показват аватарите и са кликаеми за преглед

### Курсове
- Каталог с филтриране по департаменти/категории/атрибути
- Създаване на курс (creator)
- Управление на „Създадени курсове“ (creator)
- „Моите курсове“ (купени/достъпни материали)

### Кошница и поръчки
- Guest кошница (преди login) + автоматичен sync към server cart след login
- Checkout pipeline
- Запис на поръчка и order items в базата

### Плащания
- **Stripe (test mode)** (симулация успех/отказ), избира се от `PAYMENT_PROVIDER`.

### Имейл система (Outbox pattern)
- При завършена поръчка backend‑ът създава записи в `notification_outbox`
- Worker процесът изпраща `pending` имейлите през **SendGrid** или **Mailtrap**
- Backend‑ът прави и best‑effort моментен опит за изпращане (ако доставчикът е наличен)

### Търсене и персонализация
- Логване на търсения (`search_events`) и реални **popular searches**
- Ранкиране на популярни търсения чрез **time‑decay scoring** 
- „Препоръчани за вас“: co‑occurrence от покупки и кошници + seed‑ове от активността на потребителя

---

## 2) Архитектура (overview)

```
Browser (React)
   │  REST (JSON)
   ▼
Backend API (Express)
   │  SQL
   ▼
MySQL
   │
   ├─ notification_outbox  ──► Email Worker ──► SendGrid/Mailtrap
   └─ uploads/ (avatars & materials) served as /uploads
```

### Backend (ключови модули)
- `server.js` — REST endpoints + middleware + бизнес логика
- `db.js` — MySQL pool (`mysql2/promise`)
- `utils/mailer.js` — интеграция с email provider
- `worker_email.js` — outbox worker (batch + retry политика)

### Frontend (ключови модули)
- `src/app/` — App shell + routing
- `src/features/` — функционални модули (auth, cart, catalog, chat, courses, profile, search)
- `src/pages/` — статични и legal страници
- `src/shared/` — общи компоненти и API клиент

---

## 3) Структура на проекта

```
Elitearn/
  backend/
    server.js
    db.js
    utils/
    worker_email.js
    seed/
    uploads/               # локални качени файлове (не се комитват)
    .env.example

  frontend/
    src/
      app/
      features/
      pages/
      shared/
    .env.example

  README.md
  EMAIL_SETUP.md
  SEEDS_SETUP.md
```

---

## 4) Стартиране (macOS / Linux / Windows)

### 4.1) Предварителни условия
- Node.js (LTS препоръчително)
- MySQL

### 4.2) База данни (seed)
Виж `SEEDS_SETUP.md`.

Накратко:
1) Създай празна база (пример: `elitearn`)
2) Изпълни SQL файловете от `backend/seed/` в правилния ред (01, 02, 03...)

### 4.3) Backend
1) Създай `backend/.env` 
2) Инсталирай зависимости и стартирай:

```bash
cd backend
npm install
npm run dev
```

API по подразбиране слуша на: `http://localhost:4000/api`

### 4.4) Email Worker
В отделен терминал:

```bash
cd backend
npm run worker:email
```

Подробности: `EMAIL_SETUP.md`.

### 4.5) Frontend
1) Създай `frontend/.env` 
2) Стартирай:

```bash
cd frontend
npm install
npm run dev
```

Frontend по подразбиране: `http://localhost:5173/`

---

## 5) Основни REST endpoints 

> Заб.: пълният списък е имплементиран в `backend/server.js`.

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET  /api/private/me`

### Profile
- `GET  /api/me/profile`
- `PUT  /api/me/profile`
- `POST /api/me/avatar` (multipart)
- `DELETE /api/me/avatar`
- `POST /api/me/change-password`
- `POST /api/me/delete-account`

### Catalog / Courses
- `GET /api/departments`
- `GET /api/categories`
- `GET /api/attributes`
- `GET /api/courses` (filters/search)
- `POST /api/courses` (creator)
- `PUT /api/courses/:id` (creator)
- `DELETE /api/courses/:id` (creator)

### Cart / Orders
- `GET  /api/cart`
- `POST /api/cart/items`
- `DELETE /api/cart/items/:courseId`
- `POST /api/checkout`

### Chat
- `GET  /api/chat/inbox`
- `POST /api/chat/conversations`
- `GET  /api/chat/conversations/:id/messages`
- `POST /api/chat/conversations/:id/messages`

### Search & Recommendations
- `POST /api/search/log`
- `GET  /api/search/popular`
- `GET  /api/me/recommendations`

---

## 6) Бележки за качество и сигурност

- Upload имената се „sanitize‑ват“, за да няма path traversal/опасни символи.
- JWT токенът се подава през `Authorization: Bearer <token>`.
- Popular searches и препоръките са детерминистични и обясними (евристики).

---

