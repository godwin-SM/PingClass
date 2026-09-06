-- Remove PUBLIC `USING/WITH CHECK (true)` RLS policies on notifications and
-- push_subscriptions (Supabase advisor: rls_policy_always_true).
--
-- These `service_*` policies were created for the edge functions, but every
-- consumer (send-push-notifications, notifications, check-fee-notifications)
-- runs on the service-role client, which BYPASSES RLS entirely - so the
-- policies never fire for their intended callers. Scoped to PUBLIC with
-- `true`, they instead let ANY client:
--   notifications_service_read    read every user's notifications
--   notifications_service_insert  forge notifications into anyone's inbox
--   push_sub_service_read         leak every push subscription's p256dh/auth
--   push_sub_service_delete       delete any user's push subscription
--
-- The client-facing self-scoped policies are kept:
--   notifications_self_read/update, push_sub_self_all (user_id = auth.uid())

drop policy if exists notifications_service_read   on public.notifications;
drop policy if exists notifications_service_insert on public.notifications;
drop policy if exists push_sub_service_read        on public.push_subscriptions;
drop policy if exists push_sub_service_delete      on public.push_subscriptions;