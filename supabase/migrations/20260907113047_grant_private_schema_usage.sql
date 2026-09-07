-- The private schema's nspacl lacked USAGE for service_role, so even with the
-- function-EXECUTE grant, service-role calls into private helpers returned 42501.
-- Grant USAGE and (belt-and-braces) re-grant EXECUTE on the private functions.
grant usage on schema private to service_role;
grant execute on all functions in schema private to service_role;