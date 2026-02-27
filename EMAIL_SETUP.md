# Elitearn – Email setup (Mailtrap + SendGrid)

Този проект изпраща имейли при покупка (потвърждение към купувача + известие към продавача) чрез **outbox + worker**.
Освен това backend-ът прави и **незабавен опит за изпращане** при успешно приключване на поръчка (best-effort),
за да може потвърждението да пристигне дори ако worker-ът не е стартиран в момента.

## Какво точно се случва при завършване на поръчка

1. **При успешно завършване на поръчка** backend-ът създава записи в `notification_outbox` (по един запис за всеки имейл, който трябва да бъде изпратен).
2. **Паралелно** backend-ът прави директно изпращане (best-effort). Ако SMTP/API доставчикът е достъпен, имейлът може да се изпрати веднага.
3. **Worker процесът** (`npm run worker:email`) обработва всички останали `pending` записи в `notification_outbox` и ги изпраща през **Mailtrap** или **SendGrid**.

> Практически: outbox таблицата е “опашка” за надеждно изпращане, а worker-ът е “доставчикът”, който периодично изпразва опашката.

## Where to place your Mailtrap/SendGrid credentials

Добавете **само** в:

- `backend/.env`  (създайте файла, ако липсва; или редактирайте вашия съществуващ)

### Минимална проверка, че конфигурацията е заредена
- Уверете се, че стартирате backend-а от `backend/` директорията.
- Уверете се, че `.env` файлът е точно в `backend/.env` (не в root-а на проекта и не във frontend).

## Option A – SendGrid (използван в демото)

SendGrid избягва throttling ограниченията на Mailtrap sandbox и е най-надеждният вариант за тестване на целия purchase flow.

### 1) Конфигурация

В `backend/.env` задайте:

```env
EMAIL_PROVIDER=sendgrid
EMAIL_FROM="Elitearn <your_verified_single_sender_email@example.com>"

SENDGRID_API_KEY=<your SendGrid API key>
```

**Важно:**
- `EMAIL_FROM` трябва да е **верифициран** при SendGrid (Single Sender или домейн автентикация), иначе доставчикът може да откаже изпращането.

### 2) Стартиране (backend + worker)

Стартирайте backend:

```bash
cd backend
npm install
npm run dev
```

В друг терминал стартирайте worker-а:

```bash
cd backend
npm run worker:email
```

### 3) Тест

Направете покупка → проверете входящите пощи:

- **buyer confirmation email**: обобщение на поръчката + линкове за сваляне (и прикачени файлове, когато е възможно)
- **seller notification email**: кой е купил + кога + кои курсове

## Option B – Mailtrap 

Mailtrap е подходящ за development/QA тестване, но sandbox плановете могат да върнат:

`550 5.7.0 Too many emails per second`

Това се случва, ако изпращате много съобщения бързо (напр. няколко имейла в рамките на секунда).
Ако ви се случи:
- намалете скоростта на worker-а (чрез `EMAIL_WORKER_BATCH` / `EMAIL_WORKER_INTERVAL_MS`), или
- преминете към SendGrid.

### 1) Конфигурация

В `backend/.env` добавете:

```env
EMAIL_PROVIDER=mailtrap
EMAIL_FROM="Elitearn <no-reply@elitearn.dev>"

MAILTRAP_HOST=<Host from Mailtrap>
MAILTRAP_PORT=<Port from Mailtrap>
MAILTRAP_USER=<Username from Mailtrap>
MAILTRAP_PASS=<Password from Mailtrap>
```

### 2) Стартиране (backend + worker)

Стартирайте backend:

```bash
cd backend
npm install
npm run dev
```

В друг терминал стартирайте worker-а:

```bash
cd backend
npm run worker:email
```

### 3) Тест

Направете покупка → отворете Mailtrap Inbox → трябва да видите:

- buyer confirmation email (включва закупените курсове; материалите са прикачени когато е възможно)
- seller notification email за всеки създател на курс

## Notes

- Ако worker-ът не може да изпрати имейл, редът в `notification_outbox` се маркира като `failed`, а грешката се записва в `last_error`.
- Може да направите повторен опит, като върнете статуса на реда обратно на `pending` (по избор).

### Препоръчителен workflow при проблем
1. Проверете `last_error` (дали е SMTP/API проблем, TLS проблем, rate-limit и т.н.)
2. Коригирайте `.env` настройките или доставчика
3. Върнете статуса на `pending` и стартирайте отново worker-а

### Mailtrap TLS settings

Повечето Mailtrap SMTP конфигурации работят директно с `MAILTRAP_HOST/PORT/USER/PASS`.
Ако е нужно да override-нете TLS поведението:

```env
MAILTRAP_SECURE=false          # true за implicit TLS (обикновено порт 465)
MAILTRAP_REJECT_UNAUTHORIZED=true
```

## Линкове за сваляне на материали от имейл

Потвържденията за покупка съдържат time-limited линкове за директно сваляне на материалите.
Настройте следните променливи:

- `PUBLIC_BASE_URL`: базовият URL на backend-а (напр. https://api.example.com)
- `DOWNLOAD_TOKEN_TTL`: срок на валидност на линковете (напр. `7d`, `24h`)

### Примери
- `DOWNLOAD_TOKEN_TTL=7d` → линковете са валидни 7 дни
- `DOWNLOAD_TOKEN_TTL=24h` → линковете са валидни 24 часа
