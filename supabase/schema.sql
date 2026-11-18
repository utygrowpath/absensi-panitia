-- Attendance system schema. Run this in the Supabase SQL Editor.

create extension if not exists "pgcrypto";

-- Committee members. qr_token is the opaque value encoded in each ID-card QR.
create table if not exists panitia (
  id         uuid primary key default gen_random_uuid(),
  qr_token   text not null unique,
  nama       text not null,
  divisi     text not null,
  prodi      text not null,
  angkatan   int  not null,
  created_at timestamptz not null default now()
);

-- One attendance record per member per day.
create table if not exists attendance (
  id              uuid primary key default gen_random_uuid(),
  panitia_id      uuid not null references panitia(id) on delete cascade,
  attendance_date date not null,
  status          text not null check (status in ('hadir', 'izin', 'alfa')),
  checked_in_at   timestamptz,
  updated_at      timestamptz not null default now(),
  unique (panitia_id, attendance_date)
);

create index if not exists attendance_date_idx on attendance (attendance_date);
create index if not exists panitia_divisi_idx on panitia (divisi);

-- The app talks to PostgREST as `service_role`, which does not inherit these
-- grants automatically when the tables already exist.
grant select, insert, update, delete on public.panitia to service_role;
grant select, insert, update, delete on public.attendance to service_role;
