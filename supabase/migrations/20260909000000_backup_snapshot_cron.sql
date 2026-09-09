-- Nightly GitHub backup schedule (pg_cron + net.http_post).
--
-- Runs the `backup-snapshot` edge function daily at 04:30 (UTC). The function
-- dumps all public tables via the service-role key and pushes a single commit
-- to the PRIVATE GitHub repo godwin-SM/PingClass-backups - entirely server-side.
--
-- NOTE: this supersedes the old local scheduled task (PingClassBackup), which
-- antivirus flagged as WORM.TASK.EMON.PSHELL (a heuristic false positive on
-- tasks that shell out to PowerShell). The server-side cron has no local
-- footprint at all.
--
-- Before deploying:
--   1. Store the GitHub credentials in Vault (ONCE):
--        select vault.create_secret('<GITHUB_BACKUP_TOKEN>', 'backup_github_token');
--        select vault.create_secret('godwin-SM/PingClass-backups', 'backup_github_repo');
--   2. The `internal_secret` must exist in Vault AND as the INTERNAL_SECRET
--      function secret (same value) so the cron can authenticate.
--   3. Replace <PROJECT_REF> below with your Supabase project ref.

-- NOT applied here: pg_net + pg_cron are already installed by prior cron
-- migrations; re-declaring them collides with existing extension grants.

-- (Re)create idempotently: unschedule first if it exists.
select cron.unschedule('backup-snapshot')
where exists (select 1 from cron.job where jobname = 'backup-snapshot');

select cron.schedule(
  'backup-snapshot',
  '30 4 * * *',
  $fn$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/backup-snapshot',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', (select 'Bearer ' || decrypted_secret from vault.decrypted_secrets where name = 'service_role' limit 1),
      'x-supabase-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_secret' limit 1)
    ),
    body := '{}',
    timeout_milliseconds := 30000
  )
  $fn$
);