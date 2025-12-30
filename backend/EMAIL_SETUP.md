# Elitearn – Email setup (Mailtrap + SendGrid)

This project sends order emails (buyer confirmation + seller notification) via an **outbox + worker**.
Additionally, the backend also attempts to send the emails **immediately** on successful order completion
(best-effort), so confirmations are delivered even if the worker is not running.

1. When an order is completed, the backend writes rows to `notification_outbox`.
2. The backend also sends the emails directly (best-effort).
3. Run the worker (`npm run worker:email`) to deliver any pending emails using **Mailtrap** or **SendGrid**.

## Where to place your Mailtrap/SendGrid credentials

Add the secrets **only** to:

- `backend/.env`  (create it if missing; or edit your existing one)

Do **not** commit real credentials.

## Option A – SendGrid (recommended)

SendGrid avoids Mailtrap sandbox throttling and is the most reliable option for testing the full purchase flow.

In `backend/.env` set:

```env
EMAIL_PROVIDER=sendgrid
EMAIL_FROM="Elitearn <your_verified_single_sender_email@example.com>"

SENDGRID_API_KEY=<your SendGrid API key>
```

Run backend and worker:

```bash
cd backend
npm install
npm run dev
```

In another terminal:

```bash
cd backend
npm run worker:email
```

Make a purchase → check your inboxes:

- buyer confirmation email (order summary + download links; attachments when possible)
- seller notification email (who bought + when + which courses)

## Option B – Mailtrap (email testing)

Mailtrap sandbox plans can return `550 5.7.0 Too many emails per second` if you send multiple messages quickly.
If you hit this, reduce worker speed (EMAIL_WORKER_BATCH / EMAIL_WORKER_INTERVAL_MS) or switch to SendGrid.

In `backend/.env` add:

```env
EMAIL_PROVIDER=mailtrap
EMAIL_FROM="Elitearn <no-reply@elitearn.dev>"

MAILTRAP_HOST=<Host from Mailtrap>
MAILTRAP_PORT=<Port from Mailtrap>
MAILTRAP_USER=<Username from Mailtrap>
MAILTRAP_PASS=<Password from Mailtrap>
```

Run backend and worker:

```bash
cd backend
npm install
npm run dev
```

In another terminal:

```bash
cd backend
npm run worker:email
```

Make a purchase → open your Mailtrap Inbox → you should see:

- a buyer confirmation email (includes purchased courses; materials are attached when possible)
- a seller notification email for each course creator

## Notes

- If the worker cannot send an email, the row in `notification_outbox` is marked as `failed` and the error is stored in `last_error`.
- You can re-try by setting the row back to `pending` (optional).

### Mailtrap TLS settings

Most Mailtrap SMTP configurations work out of the box with `MAILTRAP_HOST/PORT/USER/PASS`.
If you need to override TLS behavior:

```env
MAILTRAP_SECURE=false          # true for implicit TLS (usually port 465)
MAILTRAP_REJECT_UNAUTHORIZED=true
```


## Линкове за сваляне на материали от имейл
Потвържденията за покупка съдържат time-limited линкове за директно сваляне на материалите.
Настрой следните променливи:
- PUBLIC_BASE_URL: базовият URL на backend-а (напр. https://api.example.com)
- DOWNLOAD_TOKEN_TTL: срок на валидност на линковете (напр. 7d, 24h)
