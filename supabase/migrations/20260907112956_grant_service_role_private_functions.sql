-- service_role lacked EXECUTE on private helper functions (private.get_plan_limits,
-- etc.), which made service-role INSERTs raise 42501 during backups/restores and
-- any direct service-role write. Grant EXECUTE on all private functions.
grant execute on all functions in schema private to service_role;