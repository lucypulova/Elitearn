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

# 7) Подробна техническа архитектура 

## 7.1 Архитектурата на системата

Elitearn е full-stack уеб приложение с ясно разделение между **frontend**, **backend** и **database layer**.

Frontend частта е реализирана с **React и TypeScript**, а backend частта е **REST API с Node.js, Express и MySQL**.

Архитектурно backend‑ът е разделен на **routes, services, middleware, config и utility модули**, така че всяка част да има ясно дефинирана отговорност.

### Frontend

Frontend частта е реализирана с:

- React  
- TypeScript  
- Vite

Страниците са организирани по **feature‑based структура**:

- auth
- cart
- catalog
- chat
- profile
- courses
- search

Frontend‑ът комуникира с backend‑а чрез **HTTP заявки към REST API**, като обменът на данни се извършва в **JSON формат**.

### Backend

Backend‑ът представлява **Express приложение**, което реализира REST API.

Маршрутите са разделени по домейни:

- auth
- catalog
- cart
- orders
- creator
- chat
- profile
- search

Backend‑ът използва:

- middleware за **authentication**
- middleware за **error handling**
- **service слой**, в който е изнесена бизнес логиката (authService, cartService, orderService)

### Database

Базата данни използва **MySQL** и следва **релационен модел**.

Основните връзки са между таблици като:

- users
- profiles
- courses
- carts
- orders
- messages
- recommendations
- search telemetry

---

## 7.2 Защо структурата е важна

Не исках цялата логика да бъде в route файловете, защото това прави backend‑а труден за поддръжка.

Затова разделих отговорностите:

- **Route файловете** обработват HTTP заявките и връщат response.
- **Service слоят** съдържа бизнес логиката.

Този подход за **production архитектура**:

- улеснява тестването
- улеснява разширяването
- прави дебъгването по‑лесно
- прави кода по‑модулен

---

## 7.3 Express приложението и routing

В **app.js** се извършват следните действия:

- инициализира се Express
- активира се cors()
- активира се express.json()
- регистрира се статичен достъп до `/uploads`
- регистрират се всички router-и
- добавят се notFoundHandler и централен errorHandler

Входната точка на backend‑а създава Express приложението и регистрира глобалните middleware-и.

- **cors()** позволява frontend‑ът да изпраща заявки от различен origin
- **express.json()** парсва JSON body‑то на заявките

След това API‑то е разделено по домейни — authentication, catalog, orders, profile, chat и други.

Накрая има **404 handler** и **централен error handler**, така че непознати маршрути и неочаквани грешки да се обработват консистентно.

---

## 7.4 Authentication и Authorization

### Login flow

В системата login процесът работи по следния начин:

1. Потребителят изпраща **email и password**
2. Backend‑ът търси потребителя в таблицата **users**
3. Паролата се проверява чрез **bcrypt.compare**
4. Ако е валидна, се генерира **JWT token**
5. Token‑ът съдържа:
   - sub (user id)
   - email
   - role
6. Token‑ът се връща към клиента
7. Клиентът го изпраща при следващи заявки чрез

Authorization: Bearer <token>

Authentication е реализирана чрез **JWT**.

Паролите не се пазят в plain text, а като **bcrypt hash**.

При следващи заявки token‑ът се валидира от **auth middleware**, който извлича потребителя от базата.

### Какво прави middleware‑ът

В `middleware/auth.js`:

- извлича токена от header‑а
- извършва `jwt.verify`
- извлича `sub`
- проверява дали user съществува в базата
- записва user в `req.user`

След разпаковане на JWT се прави **lookup в базата**, за да се гарантира, че потребителят реално съществува.

Това предотвратява използване на стар token ако потребителят е изтрит.

### Authorization и роли

Освен authentication има и **authorization слой**.

Някои маршрути са достъпни само за specific роли:

- creator
- admin

Използва се middleware като:

requireRole("creator", "admin")

Middleware‑ът проверява `req.user.role` и връща **403 Forbidden**, ако ролята няма права.

---

## 7.5 Регистрация и защита на паролите

В `authService.js`:

- email се нормализира
- role се ограничава до позволени стойности
- проверява се дали имейлът вече съществува
- паролата се хешира с bcrypt
- извършва се insert в users
- извършва се insert/update в user_profiles

При регистрация:

- email се trim‑ва
- преобразува се в lowercase

След създаването на user записа се създава и **user profile** чрез:

ON DUPLICATE KEY UPDATE

Това прави операцията **idempotent**.

---

## 7.6 Database layer и connection pool

В `db.js` се използва:

mysql2/promise  
createPool()

Използва се **connection pool**, вместо единична връзка.

Това означава, че:

- заявките използват пул от връзки
- не се създава нова връзка всеки път

Предимства:

- по‑добра производителност
- по‑ефективно управление на ресурси

Използва се **promise API** на mysql2, което позволява работа с **async/await**.

---

## 7.7 Модел на данните

### users

Съдържа login информация:

- email
- password_hash
- role

### user_profiles

Съдържа profile информация:

- full_name
- phone
- billing_address
- city
- country
- avatar_url

Account данните са отделени от profile данните.

Това подобрява **нормализацията** и прави модела по‑гъвкав.

### courses

- title
- description
- price
- category_id
- creator_user_id
- is_published
- is_private_lesson
- contact_phone
- contact_note

### carts и cart_items

Има отделна кошница за всеки user.

`carts` съдържа:

- status (active / ordered)

`cart_items` съдържа:

- course_id
- qty

### orders и order_items

Следван е стандартен **e‑commerce модел**.

`orders` е **header таблица**.

`order_items` съдържа **line items**.

Това позволява:

- цените да се запазят в историческия контекст
- консистентна история на поръчките

### Chat

- chat_conversations
- chat_messages

Messages съдържат:

- sender_id
- receiver_id
- created_at
- is_read

### Search telemetry

`search_events`:

- query_text
- context
- user_agent
- ip
- created_at

---

## 7.8 Catalog и търсене

Endpoint:

/courses

Поддържа филтриране по:

- q
- department
- category
- sort
- attribute filters

SQL заявката се изгражда динамично според query параметрите.

Attribute filtering използва:

JOIN към course_attribute_values  
GROUP BY course  
HAVING COUNT(DISTINCT ...) = броя на филтрите

Това гарантира, че курсът съдържа **всички избрани атрибути**, а не само част от тях.

---

## 7.9 Кошница

В `cartService.js`:

- първо се търси активна кошница
- ако няма — създава се нова

При добавяне:

INSERT ... ON DUPLICATE KEY UPDATE

Така ако курсът вече е в кошницата:

- количеството се увеличава
- не се създава дублиращ ред

---

## 7.10 Orders и transaction логика

Създаването на поръчка е **транзакционна операция**.

Процесът включва:

1. Взимане на DB connection от pool
2. beginTransaction()
3. зареждане на cart items
4. проверка дали кошницата е празна
5. проверка дали user вече притежава курса
6. проверка дали user не купува собствен курс
7. създаване на orders
8. добавяне на order_items
9. маркиране на carts като ordered
10. изтриване на cart_items
11. записване на event
12. commit()

Ако някоя стъпка се провали се прави **rollback**.

Това гарантира **atomicity и консистентност**.

---

## 7.11 Payment processing

При обработка на плащане:

SELECT ... FOR UPDATE

Това заключва реда в таблицата и предотвратява **race conditions**.

Така се избягва ситуация, при която два процеса обработват една и съща поръчка.

---

## 7.12 Fulfillment и order lifecycle

Order lifecycle е разделен на етапи:

- order creation
- payment authorization
- order fulfillment

Системата записва **order events**, което позволява:

- traceability
- по‑лесно дебъгване

---

## 7.13 Background worker и Outbox Pattern

За изпращане на имейли се използва **Outbox pattern**.

Процесът работи така:

1. Backend записва събитие в **notification_outbox**
2. Worker процес чете pending записи
3. Worker изпраща имейлите асинхронно

Предимства:

- по‑добра reliability
- по‑бърз HTTP response
- retry механизъм

Worker процесът е реализиран в:

worker_email.js

---

## 7.14 Search telemetry и recommendations

### Search logging

Endpoint:

/search/log

Съхранява:

- query text
- context
- user agent
- ip
- optional user_id

### Popular searches

Endpoint:

/search/popular

Използва **time‑decay scoring**:

score = SUM(EXP(-TIMESTAMPDIFF(HOUR, created_at, NOW()) / halfLife))

Така **по‑новите търсения имат по‑голяма тежест**.

### Personalized recommendations

Endpoint:

/me/recommendations

Логиката е rule‑based.

Използват се:

- completed orders
- active cart

Използва се **co‑occurrence логика** върху order_items.

Ако няма достатъчно резултати:

fallback към същата категория.

---

## 7.15 File uploads

За качване на файлове се използва:

multer с disk storage.

Файловете получават уникално име:

timestamp + UUID + sanitized original name

Има и ограничение за **максимален размер на файла**.

---

## 7.16 Profile management и account deletion

### Profile update

Използва се **upsert** в user_profiles.

### Change password

- проверка на current password
- bcrypt hash на новата

### Delete account

Използва се transaction.

Два сценария:

1. ако няма completed orders → delete
2. ако има history → anonymize

При anonymize:

- имейлът се заменя
- генерира се нов password hash

Така се запазва **referential integrity**.

---

## 7.17 Error handling

Backend‑ът използва **централен error handler**.

Това позволява:

- консистентни error responses
- по‑чист код
- разграничение между validation, authorization и server errors

---

## 7.18 Най‑силните технически решения

Най‑силните технически решения в проекта са:

- transaction логиката при orders
- слоевата архитектура на backend‑а
- outbox worker‑ът за имейли

---



