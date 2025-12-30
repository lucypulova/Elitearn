# Backend (macOS-friendly)

## Prerequisites
- Node.js 18+ (recommended 20+)
- MySQL 8+ running locally

## Database schema (Stage 2 + Stage 3)
If you are setting up the database from scratch with the provided SQL scripts:

1) Import `seed/seed.sql`
2) Run `seed/step2.sql`
3) Run `seed/step3.sql` (adds private-lesson contact fields)

## Install
From the `backend/` folder, run the commands **separately**:

```bash
npm install
```

## Run (development)
This project uses Node's built-in watcher (cross-platform) instead of Linux-only libraries.

```bash
npm run dev
```

## Run (production)

```bash
npm start
```

## Common pitfall
Do **not** combine commands like this:

```bash
npm instal npm run dev
```

1) `install` must be spelled correctly (`npm install`).
2) `npm run dev` must be executed as a separate command.


## Chat (Stage 4)

After importing `seed/seed.sql` and applying `seed/step2.sql` + `seed/step3.sql` (or `seed/step3_patched.sql`), also run:

- `seed/step4_chat.sql`  (adds buyer↔creator chat per course, including pre-purchase questions)
