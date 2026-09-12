-- Bug reports — submitted by signed-in users from the in-app "Report a problem"
-- dialog (edge function `submit-bug-report`), read by the PingClass owner.
-- Function-only table: no anon/authenticated PostgREST access; both write and
-- the maker-side read go through the service role.

create table public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null,
  reporter_email text,
  role text,
  page text,
  message text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

alter table public.bug_reports enable row level security;
alter table public.bug_reports force row level security;

-- Explicit intent: no direct Data API access for anon/authenticated.
create policy "bug_reports_no_public_access"
  on public.bug_reports
  for all
  using (false);

grant select, insert, update, delete on public.bug_reports to service_role;