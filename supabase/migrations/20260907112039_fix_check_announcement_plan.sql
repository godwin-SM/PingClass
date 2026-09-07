-- Fix check_announcement_plan: the previous body used
--   SET search_path TO ''  +  SELECT institute_id FROM public.institutes
-- which raised 42703 (institutes has no institute_id column; PK is id), so every
-- announcement INSERT failed for all roles. Route through private.get_plan_limits.
CREATE OR REPLACE FUNCTION public.check_announcement_plan()
 RETURNS trigger
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v_limits record;
begin
  select * into v_limits from private.get_plan_limits(NEW.institute_id);

  if not v_limits.announcements_allowed then
    raise exception 'Announcements require a paid plan.';
  end if;

  return new;
end;
$function$;

-- Keep the trigger attached as-is.