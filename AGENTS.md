# PingClass - Dev Conventions

## Database migrations (Supabase)

### Every new table/view in `public` needs EXPLICIT grants
Since Supabase's change (discussion #45329, enforced 2026-10-30), objects created
in the `public` schema are NO LONGER auto-exposed to the Data API by default.
Treat these three steps as one unit, in the SAME migration that creates the object:

```sql
create table public.thing ( ... );          -- 1. create
alter table public.thing enable row level security;  -- 2. RLS (always)
create policy ... on public.thing for ... using (...); -- 2b. policies
-- 3. explicit grants (choose per role; anon usually SELECT-only)
grant select on public.thing to anon;
grant select, insert, update, delete on public.thing to authenticated;
grant select, insert, update, delete on public.thing to service_role;
```

Without the grant, PostgREST returns `42501 permission denied` (`hint` includes the
exact GRANT statement). Server-only helper tables (e.g. secrets, config) must NOT
be granted to anon/authenticated.

### New RPC functions
`grant execute on function public.my_rpc(...) to anon, authenticated` in the same
migration. Keep security-definer/guard functions (get_secret, limits, rate-limit)
restricted to `service_role`.

### Timestamps
Migrations are timestamped `YYYYMMDDHHMMSS_name.sql` (UTC). <= 0000 = dashboard-created.

## Other rules
- Client code calls `.rpc()` / `.from()` through supabase-js only; never expose the
  service_role key in frontend code.
- Rebuild minified assets after changing source JS/CSS (see console history), bump
  the `?v=` query on the HTML reference.