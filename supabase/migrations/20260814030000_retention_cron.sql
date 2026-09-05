-- Retention cleanup schedule (pg_cron + net.http_post).
--
-- Runs the `retention-cleanup` edge function daily at 03:30. Financial records
-- (fees/payments/subscriptions) are never touched by the function — only stale
-- invite tokens and orphaned link rows are purged. Financial data is retained
-- for 6 years under Indian tax law (IT Act 1961 s.44AA / Rule 6F; GST Act
-- 2017 s.36) as documented in privacy.html §8.
--
-- Before deploying:
--   1. Set the edge-function secret:
--        supabase functions secrets set RETENTION_SECRET --env-file .env.local
--      (or a 32-byte random value).
--   2. Store the service-role key and the retention secret in Vault:
--        select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role');
--        select vault.create_secret('<RETENTION_SECRET>',  'retention_secret');
--      (These calls run ONCE; use the CLI secret value, then remove the file.)
--   3. Replace <PROJECT_REF> below with your Supabase project ref.

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- (Re)create idempotently: unschedule first if it exists.
select cron.unschedule('retention-cleanup')
where exists (select 1 from cron.job where jobname = 'retention-cleanup');

select cron.schedule(
  'retention-cleanup',
  '30 3 * * *',
  $fn$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/retention-cleanup',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'apikey',        (select decrypted_secret from vault.decrypted_secrets where name = 'service_role' limit 1),
      'Authorization', (select 'Bearer ' || decrypted_secret from vault.decrypted_secrets where name = 'service_role' limit 1),
      'x-supabase-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'retention_secret' limit 1)
    ),
    body := '{}'
  )
  $fn$
);
