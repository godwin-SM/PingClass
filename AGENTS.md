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

## Edge function secrets
Functions that must be reachable ONLY from cron/other functions are NOT secured by
`verify_jwt` alone (any valid user JWT passes). Guard them with a shared secret:

- One 32-byte random value, stored in TWO places with the SAME value:
  - Deno env: `supabase secrets set --project-ref <ref> INTERNAL_SECRET=<value>`
  - Database Vault (so cron can send it): `vault.create_secret('<value>', 'internal_secret')`
- Function compares `req.headers.get("x-supabase-secret")` to `Deno.env.get("INTERNAL_SECRET")`
  (constant-time compare; `Deno.env.get("...") ?? ""`). 401 without it.
- Cron jobs send the header via
  `jsonb_build_object('x-supabase-secret', (select decrypted_secret from vault.decrypted_secrets where name='internal_secret' limit 1))`.
- NEVER commit the secret. Migrations reference `internal_secret` by name, never by value.
- Inner functions (push/email) must be called with the header explicitly — a caller
  reaching them without the header means the caller is NOT sanctioned.
- Start any existing function that silently relied on "no auth" (check-fee-notifications,
  send-push-notifications, send-overdue-email) as `verify_jwt = true` in config.toml
  and on deploy; precedence applies on top of the secret check.
- The 24h rate-limit pattern (`check-email`) is the default for money/invite paths.