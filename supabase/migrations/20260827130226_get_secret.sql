-- Secure RPC to read Vault secrets, service_role-only.
-- Used by send-push-notifications edge function to load VAPID keys.
-- SECURITY DEFINER is intentional: the vault schema is not exposed to PostgREST,
-- and only service_role is granted EXECUTE.

CREATE OR REPLACE FUNCTION public.get_secret(name_to_get text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = vault, public
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = name_to_get LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_secret(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_secret(text) FROM anon;
REVOKE ALL ON FUNCTION public.get_secret(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_secret(text) TO service_role;