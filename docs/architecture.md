# Architecture

This page explains how a scan turns into a database row, how admin access is enforced, and why the schema looks the way it does. Read it before changing attendance rules or adding a page.

## Data model

Two tables hold everything.

```sql
panitia
  id          uuid PK
  qr_token    text unique   -- the value printed in the QR code
  nama        text
  divisi      text
  prodi       text
  angkatan    int
  created_at  timestamptz

attendance
  id              uuid PK
  panitia_id      uuid FK → panitia, cascade delete
  attendance_date date
  status          text check in ('hadir', 'izin', 'alfa')
  checked_in_at   timestamptz
  updated_at      timestamptz
  unique (panitia_id, attendance_date)
```

The unique constraint on `(panitia_id, attendance_date)` is the rule that keeps one person to one record per day. Everything else in `lib/attendance.ts` relies on it.

`qr_token` is an opaque UUID. It carries no name, division, or any other field, so a photographed ID card exposes nothing on its own.

## Attendance rules

`lib/attendance.ts` holds three rules, each covered by a unit test.

- `markHadir` creates a record when none exists for the day. A second scan returns the original `checked_in_at` instead of overwriting it, so the logged time is the first arrival. A scan over an existing `izin` or `alfa` record corrects it to `hadir`.
- `setStatus` writes whatever status the admin picks. It stamps `checked_in_at` only for `hadir` and clears it otherwise, which keeps the log column honest.
- `daySummary` counts each status and derives `belum` from the total, so the dashboard never drifts from the rows.

A scan is scoped to one date. Scanning on the 19th never edits a record from the 18th.

## Authentication

There is one admin account, defined by `ADMIN_USERNAME` and `ADMIN_PASSWORD` in the environment.

`lib/session.ts` signs `{ exp }` with HMAC-SHA256 using `SESSION_SECRET` and packs it into an httpOnly cookie. Verification checks the signature with a constant-time comparison, then the expiry, so a forged cookie cannot be guessed byte by byte.

Access is enforced in two places:

1. `proxy.ts` redirects signed-out requests away from `/admin`. This is a convenience, not the boundary.
2. Every server action calls `requireAdmin()` first. Server actions accept direct `POST` requests, so the layout check alone would leave them open.

`lib/auth.ts` wraps the pure token code with `next/headers` cookie access. `lib/session.ts` stays free of that import so `proxy.ts` can use it.

## Rendering model

The project runs with `cacheComponents: true`, which changes how dynamic data works in Next.js 16.

Route segment configs like `dynamic = "force-dynamic"` are no longer valid. Instead, `app/admin/layout.tsx` and each admin page export `instant = false`, which tells the framework these routes block on purpose. They read the session cookie and live attendance rows, so there is no static shell to ship.

The dashboard and manual pages also call `await connection()` before `todayInJakarta()`. `new Date()` cannot run during prerendering, and `connection()` moves that work to request time.

## Page map

| Route | Reads | Writes |
| --- | --- | --- |
| `/login` | Credentials from the environment | Session cookie |
| `/admin` | Today's counts and pending members | None |
| `/admin/panitia` | All members | Create, update, delete |
| `/admin/log` | Attendance joined with members | None |
| `/admin/manual` | Members with today's status | `setAttendanceStatus` |
| `/admin/scan` | None during render | `scanAttendance` |
| `/admin/qr` | All members with their tokens | None |

Mutations live in `app/admin/actions.ts` and `app/login/actions.ts`, both marked `"use server"`. Each one validates its own input, re-checks the session, and calls `revalidatePath("/admin", "layout")` so the next render shows fresh numbers.

## QR codes

The QR page renders SVG through `qrcode.react` in the browser, which keeps the server bundle free of a QR encoder and makes the print stylesheet straightforward.

Scanning uses `html5-qrcode`, imported dynamically inside a client component because the library reads `window` at import time. If the camera is unavailable, the scan page offers a text field for pasting the token.
