# Presensi Panitia

A committee attendance system for event day. Admins sign in, scan the QR code printed on each ID card, and watch the day's numbers update. QR codes are static, so you print them once and mount them on the cards.

## What it does

- **Dashboard**: counts of hadir, izin, alfa, and who has not checked in yet, grouped by division
- **Committee**: search, filter, and edit the 70 members imported from `data_panitia.csv`
- **Attendance log**: every record with the time it was written
- **Manual check-in**: change anyone's status for any date
- **Scan QR**: point a camera at an ID card to mark the member present
- **QR codes**: generate and print one static code per member

## Stack

Next.js 16 (App Router, Cache Components), React 19, Tailwind CSS 4, and Supabase Postgres. Attendance data lives in two tables: `panitia` and `attendance`.

## Set up

### 1. Create the tables

Open the Supabase SQL Editor for your project and run `supabase/schema.sql`. If the tables already exist but the app reports `permission denied for table …`, run `supabase/grants.sql` instead.

### 2. Configure environment variables

Copy the example file and fill in your project's values:

```bash
cp .env.example .env.local
```

| Variable | Where it comes from |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase, Project Settings → Data API |
| `SUPABASE_SECRET_KEY` | Supabase, Project Settings → API keys |
| `ADMIN_USERNAME` | Any value you choose |
| `ADMIN_PASSWORD` | Any value you choose |
| `SESSION_SECRET` | Any long random string |

`SUPABASE_SECRET_KEY` grants full access to every row. Keep it on the server: `.env.local` is git-ignored, and only server code imports `lib/supabase.ts`.

### 3. Load the committee

```bash
npm run seed
```

The script reads `data_panitia.csv`, writes 70 members, and gives each one a QR token. It skips the write if the table already holds rows, so you can run it again safely.

### 4. Start the app

```bash
npm run dev
```

Open `http://localhost:3000` and sign in with the credentials from step 2.

## Tests

```bash
npm test         # unit tests, no database needed
npm run test:e2e # server actions against the running app and database
```

Unit tests cover the attendance rules, session tokens, timezone handling, and CSV parsing. The end-to-end run needs `npm run dev` on port 3000 and a seeded database; it signs in, scans a QR code twice, changes a status, and cleans up after itself.

## Deploy to Vercel

1. Import the repository into Vercel.
2. Add every variable from step 2 to the project's environment settings. Use production values for `ADMIN_PASSWORD` and `SESSION_SECRET`.
3. Deploy. Run `npm run seed` once from your machine against the production URL, or point `.env.local` at production and run it there.

The scanner needs a secure context. Vercel serves HTTPS, so camera scanning works on the deployed URL. `http://localhost` also counts as secure during development.

## Timezone

Dates are computed in `Asia/Jakarta`. A record written at 00:30 WIB counts toward that day, not the previous UTC day. The rule lives in `lib/time.ts`.

## Project layout

| Path | Role |
| --- | --- |
| `proxy.ts` | Redirects signed-out visitors away from `/admin` |
| `lib/session.ts` | Signs and verifies the admin session cookie |
| `lib/attendance.ts` | Scan and status rules, daily counts |
| `lib/time.ts` | Jakarta date and time formatting |
| `scripts/seed.ts` | Imports `data_panitia.csv` |
| `app/admin/` | The six admin pages and their server actions |
| `supabase/` | Schema and grant statements |

More detail in [`docs/architecture.md`](docs/architecture.md) and [`docs/deployment.md`](docs/deployment.md).
