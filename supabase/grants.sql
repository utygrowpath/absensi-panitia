-- Grants for an existing install. Run this in the Supabase SQL Editor if the
-- app reports "permission denied for table …" as service_role.

grant select, insert, update, delete on public.panitia to service_role;
grant select, insert, update, delete on public.attendance to service_role;
