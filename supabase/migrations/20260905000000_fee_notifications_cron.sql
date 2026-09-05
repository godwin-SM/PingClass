-- Fee/overdue notification schedule (pg_cron + net.http_post).
--
-- Runs the `check-fee-notifications` edge function daily at 02:30. The function
-- walks each institute's pending payments and sends (a) in-app notifications,
-- (b) web push, and (c) for overdue fees, a Resend email via the
-- `send-overdue-email` edge function to the linked parent.
--
-- HISTORY: the original (dashboard-created) job used a malformed command that
-- concatenated vault.decrypted_secret(...) calls inside a string literal, e.g.
--   headers := '{"Authorization": "Bearer " || vault.decrypted_secret(...)}'
-- which never compiled, so pg_cron FAILED every night at 02:30 and the edge
-- function was never invoked. This migration recreates the job with a correct
-- jsonb_build_object(...) command. It is idempotent (unschedules by name first).
--
-- Before deploying:
--   1. The `service_role` secret must exist in Vault:
--        select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role');
--      (Runs ONCE; use the CLI secret value, then remove the file.)
--   2. Replace <PROJECT_REF> below with your Supabase project ref.
--
-- NOTE: timeout_milliseconds is raised above pg_net's 5s default because the
-- edge function legitimately takes several seconds (it iterates payments and
-- fans out to push/email); at the default timeout pg_cron logs a spurious
-- FAILED (timeout) despite the work completing.

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- (Re)create idempotently: unschedule first if it exists.
select cron.unschedule('fee-notifications')
where exists (select 1 from cron.job where jobname = 'fee-notifications');

select cron.schedule(
  'fee-notifications',
  '30 2 * * *',
  $fn$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/check-fee-notifications',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', (select 'Bearer ' || decrypted_secret from vault.decrypted_secrets where name = 'service_role' limit 1)
    ),
    timeout_milliseconds := 20000
  )
  $fn$
);