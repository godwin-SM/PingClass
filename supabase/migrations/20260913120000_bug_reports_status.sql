-- Bug report triage statuses used by the PingClass maker console (ceo-pingclass).
-- The submit-bug-report path writes status 'open'; the console moves items through
-- open -> in_progress -> resolved/ignored (and back to open to reopen).

alter table public.bug_reports
  drop constraint if exists bug_reports_status_check;

alter table public.bug_reports
  add constraint bug_reports_status_check
  check (status in ('open', 'in_progress', 'resolved', 'ignored'));

-- Maker console reads the bug inbox newest-first and filters by status often.
create index if not exists bug_reports_status_created_idx
  on public.bug_reports (status, created_at desc);