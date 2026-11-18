# Deployment

This page covers shipping the app to Vercel and the checks worth running before event day.

## Before you deploy

Run these three commands locally:

```bash
npm run lint
npm test
npm run build
```

All three must pass. `npm run build` also type-checks the project, which catches import and Server Component boundary mistakes that `next dev` tolerates.

## Environment variables

Add every variable from `.env.example` to the Vercel project under Settings → Environment Variables.

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Same value in every environment |
| `SUPABASE_SECRET_KEY` | Server only; never expose it to the browser |
| `ADMIN_USERNAME` | Choose a production value |
| `ADMIN_PASSWORD` | Choose a production value |
| `SESSION_SECRET` | A long random string; rotating it signs everyone out |

Generate `SESSION_SECRET` with:

```bash
openssl rand -base64 48
```

Mark `SUPABASE_SECRET_KEY` as sensitive in Vercel so it does not appear in build logs.

## Database

The production database needs the same two statements as development. Run `supabase/schema.sql` in the SQL Editor of the production project, then `supabase/grants.sql` if the app reports `permission denied for table …`.

Seed the production database once the URL and key are in place:

```bash
npm run seed
```

Point `.env.local` at the production project first, or set the variables in your shell. The script skips the write when the table already holds rows, so a repeat run cannot duplicate members.

## Scanner requirements

Camera scanning needs a secure context: HTTPS or `localhost`. Vercel serves HTTPS on every deployment, so scanning works at the deployed URL without extra configuration.

The scanner requests the rear camera through `facingMode: "environment"`. On a phone, open the scan page in the device browser rather than an in-app webview, since some webviews withhold camera permission.

## Post-deploy checks

1. Visit `/admin` signed out. You should land on `/login`.
2. Sign in with the production credentials.
3. Confirm the dashboard reports 70 members.
4. Open `/admin/qr` and confirm 70 codes render.
5. Scan one code from a printed card, then reload the dashboard and confirm the count moved.
6. Scan the same card again. The count must not change, and the log must show a single record with the first scan's time.
7. Open `/admin/manual`, set that member to izin, and confirm the dashboard moves them out of the hadir count.

## Timezone

The app computes dates in `Asia/Jakarta`. Vercel functions run in UTC, which is fine because the conversion happens in `lib/time.ts` with an explicit `timeZone` rather than relying on the host clock. No `TZ` environment variable is required.

## Rollback

Vercel keeps a deployment history. Promote a previous deployment from the Deployments tab to roll back. Database rows are untouched by a rollback, so attendance records survive.

If you need to undo a schema change, edit the table in the SQL Editor. There is no migration framework in this project; `supabase/schema.sql` is the source of truth and uses `create table if not exists`.
