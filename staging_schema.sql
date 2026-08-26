-- ============================================================
-- PingClass Full Schema Migration (Staging)
-- Generated from production database
-- ============================================================

-- ============================================================
-- 1. SCHEMAS
-- ============================================================
CREATE SCHEMA IF NOT EXISTS private;

-- ============================================================
-- 2. TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.institutes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid,
  phone text,
  email text,
  address text,
  created_at timestamptz DEFAULT now(),
  name_changed_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.users (
  id uuid NOT NULL,
  institute_id uuid,
  full_name text NOT NULL,
  phone text,
  role text NOT NULL,
  created_at timestamptz DEFAULT now(),
  email text,
  full_name_changed_at timestamptz,
  onboarded_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.batches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  institute_id uuid,
  name text NOT NULL,
  subject text,
  schedule text,
  teacher_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.students (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  institute_id uuid,
  full_name text NOT NULL,
  parent_id uuid,
  phone text,
  email text,
  created_at timestamptz DEFAULT now(),
  parent_consent boolean NOT NULL DEFAULT false,
  parent_consent_by text,
  parent_consent_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.student_batches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid,
  batch_id uuid,
  enrolled_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  batch_id uuid,
  amount numeric NOT NULL,
  frequency text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  institute_id uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid,
  fee_id uuid,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  due_date date NOT NULL,
  paid_at date,
  created_at timestamptz DEFAULT now(),
  batch_id uuid,
  institute_id uuid,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid,
  batch_id uuid,
  date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL,
  marked_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  institute_id uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  institute_id uuid,
  title text NOT NULL,
  message text NOT NULL,
  target text NOT NULL,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  target_batch_id uuid,
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  plan_id text NOT NULL,
  amount numeric NOT NULL,
  razorpay_payment_id text,
  status text DEFAULT 'active'::text,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS public.parent_student_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL,
  student_id uuid NOT NULL,
  institute_id uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invite_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role text NOT NULL,
  institute_id uuid NOT NULL,
  invited_by uuid NOT NULL,
  student_id uuid,
  token text NOT NULL,
  used boolean DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  name text
);

CREATE TABLE IF NOT EXISTS public.institute_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  institute_id uuid NOT NULL,
  notify_fee_reminders boolean NOT NULL DEFAULT true,
  notify_attendance_alerts boolean NOT NULL DEFAULT true,
  notify_announcements boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
  user_id uuid NOT NULL,
  action text NOT NULL,
  bucket timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.waitlist (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  created_at timestamptz DEFAULT now(),
  source text DEFAULT 'landing_page'::text
);

-- ============================================================
-- 3. PRIMARY KEYS
-- ============================================================

ALTER TABLE public.institutes ADD PRIMARY KEY (id);
ALTER TABLE public.users ADD PRIMARY KEY (id);
ALTER TABLE public.batches ADD PRIMARY KEY (id);
ALTER TABLE public.students ADD PRIMARY KEY (id);
ALTER TABLE public.student_batches ADD PRIMARY KEY (id);
ALTER TABLE public.fees ADD PRIMARY KEY (id);
ALTER TABLE public.payments ADD PRIMARY KEY (id);
ALTER TABLE public.attendance ADD PRIMARY KEY (id);
ALTER TABLE public.announcements ADD PRIMARY KEY (id);
ALTER TABLE public.subscriptions ADD PRIMARY KEY (id);
ALTER TABLE public.parent_student_links ADD PRIMARY KEY (id);
ALTER TABLE public.invite_tokens ADD PRIMARY KEY (id);
ALTER TABLE public.institute_settings ADD PRIMARY KEY (id);
ALTER TABLE public.rate_limit_hits ADD PRIMARY KEY (user_id, action, bucket);
ALTER TABLE public.audit_log ADD PRIMARY KEY (id);
ALTER TABLE public.waitlist ADD PRIMARY KEY (id);

-- ============================================================
-- 4. FOREIGN KEYS
-- ============================================================

ALTER TABLE public.users ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id);
ALTER TABLE public.users ADD CONSTRAINT users_institute_id_fkey FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE CASCADE;

ALTER TABLE public.batches ADD CONSTRAINT batches_institute_id_fkey FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE CASCADE;
ALTER TABLE public.batches ADD CONSTRAINT batches_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.users(id);

ALTER TABLE public.students ADD CONSTRAINT students_institute_id_fkey FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE CASCADE;
ALTER TABLE public.students ADD CONSTRAINT students_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.users(id);

ALTER TABLE public.student_batches ADD CONSTRAINT student_batches_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
ALTER TABLE public.student_batches ADD CONSTRAINT student_batches_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE CASCADE;

ALTER TABLE public.fees ADD CONSTRAINT fees_institute_id_fkey FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE CASCADE;
ALTER TABLE public.fees ADD CONSTRAINT fees_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE CASCADE;

ALTER TABLE public.payments ADD CONSTRAINT payments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD CONSTRAINT payments_fee_id_fkey FOREIGN KEY (fee_id) REFERENCES public.fees(id);
ALTER TABLE public.payments ADD CONSTRAINT payments_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD CONSTRAINT payments_institute_id_fkey FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE CASCADE;

ALTER TABLE public.attendance ADD CONSTRAINT attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE CASCADE;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_marked_by_fkey FOREIGN KEY (marked_by) REFERENCES public.users(id);
ALTER TABLE public.attendance ADD CONSTRAINT attendance_institute_id_fkey FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE CASCADE;

ALTER TABLE public.announcements ADD CONSTRAINT announcements_institute_id_fkey FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE CASCADE;
ALTER TABLE public.announcements ADD CONSTRAINT announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE public.announcements ADD CONSTRAINT announcements_target_batch_id_fkey FOREIGN KEY (target_batch_id) REFERENCES public.batches(id) ON DELETE SET NULL;

ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE public.parent_student_links ADD CONSTRAINT parent_student_links_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.parent_student_links ADD CONSTRAINT parent_student_links_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
ALTER TABLE public.parent_student_links ADD CONSTRAINT parent_student_links_institute_id_fkey FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE CASCADE;

ALTER TABLE public.invite_tokens ADD CONSTRAINT invite_tokens_institute_id_fkey FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE CASCADE;
ALTER TABLE public.invite_tokens ADD CONSTRAINT invite_tokens_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE SET NULL;

ALTER TABLE public.institute_settings ADD CONSTRAINT institute_settings_institute_id_fkey FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE CASCADE;

ALTER TABLE public.rate_limit_hits ADD CONSTRAINT rate_limit_hits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

-- ============================================================
-- 5. UNIQUE CONSTRAINTS
-- ============================================================

ALTER TABLE public.attendance ADD CONSTRAINT attendance_student_id_batch_id_date_key UNIQUE (student_id, batch_id, date);
ALTER TABLE public.institute_settings ADD CONSTRAINT institute_settings_institute_id_key UNIQUE (institute_id);
ALTER TABLE public.invite_tokens ADD CONSTRAINT invite_tokens_token_key UNIQUE (token);
ALTER TABLE public.parent_student_links ADD CONSTRAINT parent_student_links_parent_id_student_id_key UNIQUE (parent_id, student_id);
ALTER TABLE public.student_batches ADD CONSTRAINT student_batches_student_id_batch_id_key UNIQUE (student_id, batch_id);
ALTER TABLE public.waitlist ADD CONSTRAINT waitlist_email_key UNIQUE (email);

-- ============================================================
-- 6. CHECK CONSTRAINTS
-- ============================================================

ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'teacher', 'parent'));
ALTER TABLE public.batches ADD CONSTRAINT batches_name_check CHECK (length(name) > 0);
ALTER TABLE public.students ADD CONSTRAINT students_full_name_check CHECK (length(full_name) > 0);
ALTER TABLE public.fees ADD CONSTRAINT fees_frequency_check CHECK (frequency IN ('monthly', 'quarterly', 'yearly'));
ALTER TABLE public.payments ADD CONSTRAINT payments_status_check CHECK (status IN ('pending', 'paid', 'overdue'));
ALTER TABLE public.attendance ADD CONSTRAINT attendance_status_check CHECK (status IN ('present', 'absent', 'late'));
ALTER TABLE public.announcements ADD CONSTRAINT announcements_target_check CHECK (target IN ('all', 'teachers', 'parents'));
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_id_check CHECK (plan_id IN ('free', 'basic', 'pro'));
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check CHECK (status IN ('active', 'expired', 'cancelled'));
ALTER TABLE public.invite_tokens ADD CONSTRAINT invite_tokens_role_check CHECK (role IN ('admin', 'teacher', 'parent'));
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_action_check CHECK (action IN ('INSERT', 'UPDATE', 'DELETE'));
ALTER TABLE public.waitlist ADD CONSTRAINT waitlist_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- ============================================================
-- 7. INDEXES
-- ============================================================

-- Users
CREATE INDEX IF NOT EXISTS idx_users_active ON public.users (id) WHERE deleted_at IS NULL;

-- Batches
CREATE INDEX IF NOT EXISTS idx_batches_institute_id ON public.batches (institute_id);
CREATE INDEX IF NOT EXISTS idx_batches_teacher_id ON public.batches (teacher_id);
CREATE INDEX IF NOT EXISTS idx_batches_active ON public.batches (id) WHERE deleted_at IS NULL;

-- Students
CREATE INDEX IF NOT EXISTS idx_students_institute_id ON public.students (institute_id);
CREATE INDEX IF NOT EXISTS idx_students_parent_id ON public.students (parent_id);
CREATE INDEX IF NOT EXISTS idx_students_active ON public.students (id) WHERE deleted_at IS NULL;

-- Student Batches
CREATE INDEX IF NOT EXISTS idx_student_batches_student ON public.student_batches (student_id);
CREATE INDEX IF NOT EXISTS idx_student_batches_batch ON public.student_batches (batch_id);

-- Fees
CREATE INDEX IF NOT EXISTS idx_fees_batch_id ON public.fees (batch_id);
CREATE INDEX IF NOT EXISTS idx_fees_institute_id ON public.fees (institute_id);

-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_institute_id ON public.payments (institute_id);
CREATE INDEX IF NOT EXISTS idx_payments_student_id ON public.payments (student_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_due_date ON public.payments (due_date);
CREATE INDEX IF NOT EXISTS idx_payments_batch_id ON public.payments (batch_id);

-- Attendance
CREATE INDEX IF NOT EXISTS idx_attendance_batch_id_date ON public.attendance (batch_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON public.attendance (student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_institute_id ON public.attendance (institute_id);

-- Announcements
CREATE INDEX IF NOT EXISTS announcements_institute_created_idx ON public.announcements (institute_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON public.announcements (id) WHERE deleted_at IS NULL;

-- Parent Student Links
CREATE INDEX IF NOT EXISTS idx_psl_parent ON public.parent_student_links (parent_id);
CREATE INDEX IF NOT EXISTS idx_psl_student ON public.parent_student_links (student_id);
CREATE INDEX IF NOT EXISTS idx_psl_institute ON public.parent_student_links (institute_id);

-- Invite Tokens
CREATE INDEX IF NOT EXISTS idx_invite_email ON public.invite_tokens (email);
CREATE INDEX IF NOT EXISTS idx_invite_token ON public.invite_tokens (token);

-- Subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires_at ON public.subscriptions (expires_at);

-- Audit Log
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON public.audit_log (table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_record_id ON public.audit_log (record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log (created_at DESC);

-- ============================================================
-- 8. PRIVATE SCHEMA FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION private.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  select role from public.users where id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION private.get_user_institute_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  select institute_id from public.users where id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION private.is_batch_teacher(p_batch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  select exists (
    select 1 from public.batches
    where id = p_batch_id and teacher_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION private.is_institute_admin(inst_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin' and institute_id = inst_id
  );
$function$;

CREATE OR REPLACE FUNCTION private.is_parent_of(target_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  select exists (
    select 1 from public.parent_student_links
    where parent_id = auth.uid() and student_id = target_id
  );
$function$;

CREATE OR REPLACE FUNCTION private.student_in_institute(p_student_id uuid, p_institute_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  select exists (
    select 1 from public.students s
    where s.id = p_student_id and s.institute_id = p_institute_id
  );
$function$;

CREATE OR REPLACE FUNCTION private.get_plan_limits(inst_id uuid)
RETURNS TABLE(plan_id text, max_students integer, max_batches integer, max_teachers integer, announcements_allowed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
declare
  v_owner_id uuid;
  v_plan text;
begin
  select owner_id into v_owner_id
  from public.institutes
  where id = inst_id;

  if v_owner_id is null then
    plan_id := 'free';
    max_students := 20;
    max_batches := 1;
    max_teachers := 1;
    announcements_allowed := false;
    return next;
    return;
  end if;

  select s.plan_id into v_plan
  from public.subscriptions s
  where s.user_id = v_owner_id
    and s.expires_at > now()
    and s.status = 'active'
  order by s.created_at desc
  limit 1;

  if v_plan is null then
    v_plan := 'free';
  end if;

  plan_id := v_plan;
  case v_plan
    when 'free' then
      max_students := 20; max_batches := 1; max_teachers := 1; announcements_allowed := false;
    when 'basic' then
      max_students := 100; max_batches := 5; max_teachers := 5; announcements_allowed := true;
    when 'pro' then
      max_students := 999999; max_batches := 999999; max_teachers := 999999; announcements_allowed := true;
    else
      max_students := 20; max_batches := 1; max_teachers := 1; announcements_allowed := false;
  end case;

  return next;
end;
$function$;

CREATE OR REPLACE FUNCTION private.get_announcements(p_limit integer DEFAULT 20, p_cursor timestamptz DEFAULT NULL, p_cursor_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid, title text, message text, target text, target_batch_id uuid, batch_name text, created_by uuid, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  select a.id, a.title, a.message, a.target, a.target_batch_id,
         b.name as batch_name, a.created_by, a.created_at
  from public.announcements a
  left join public.batches b on b.id = a.target_batch_id
  where a.institute_id = private.get_user_institute_id()
    and a.deleted_at is null
    and (
      private.get_user_role() = 'admin'
      or a.target = 'all'
      or a.target = case private.get_user_role() when 'teacher' then 'teachers' when 'parent' then 'parents' else null end
      or (
        a.target_batch_id is not null
        and private.get_user_role() = 'parent'
        and exists (
          select 1 from public.student_batches sb
          join public.students s on s.id = sb.student_id
          where sb.batch_id = a.target_batch_id
            and s.parent_id = auth.uid()
        )
      )
      or (
        a.target_batch_id is not null
        and private.get_user_role() = 'teacher'
        and exists (
          select 1 from public.batches bt
          where bt.id = a.target_batch_id
            and bt.teacher_id = auth.uid()
        )
      )
    )
    and (p_cursor is null or (a.created_at, a.id) < (p_cursor, p_cursor_id))
  order by a.created_at desc, a.id desc
  limit p_limit;
$function$;

CREATE OR REPLACE FUNCTION private.get_invite_token(p_token_id uuid)
RETURNS TABLE(id uuid, email text, role text, name text, institute_id uuid, student_id uuid, used boolean, expires_at timestamptz, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  select t.id, t.email, t.role, t.name, t.institute_id, t.student_id, t.used, t.expires_at, t.created_at
  from public.invite_tokens t
  where t.id = p_token_id
    and t.used = false
    and t.expires_at > now()
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION private.get_institute_name(p_token_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  select i.name
  from public.invite_tokens t
  join public.institutes i on i.id = t.institute_id
  where t.id = p_token_id
    and t.used = false
    and t.expires_at > now()
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION private.check_email_exists(check_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $function$
  select exists (select 1 from auth.users where email = lower(check_email));
$function$;

CREATE OR REPLACE FUNCTION private.record_subscription(p_plan_id text, p_payment_id text, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if p_plan_id not in ('basic', 'pro') then
    raise exception 'Invalid plan selected.';
  end if;

  if p_payment_id is null or trim(p_payment_id) = '' then
    raise exception 'Missing payment reference.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Invalid payment amount.';
  end if;

  if exists (select 1 from public.subscriptions where razorpay_payment_id = p_payment_id) then
    raise exception 'This payment has already been recorded.';
  end if;

  insert into public.subscriptions (user_id, plan_id, amount, razorpay_payment_id, status, expires_at)
  values (auth.uid(), p_plan_id, p_amount, p_payment_id, 'active', now() + interval '30 days');
end;
$function$;

CREATE OR REPLACE FUNCTION private.refresh_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF private.get_user_role() != 'admin' THEN
    RAISE EXCEPTION 'Only admins can refresh analytics.';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION private.soft_delete(p_table text, p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF private.get_user_role() != 'admin' THEN
    RAISE EXCEPTION 'Only admins can delete records.';
  END IF;

  IF p_table NOT IN ('students', 'batches', 'users', 'announcements') THEN
    RAISE EXCEPTION 'Invalid table for soft delete.';
  END IF;

  EXECUTE format(
    'UPDATE public.%I SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
    p_table
  ) USING p_id;

  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION private.audit_trigger_func()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid;
  v_old_data jsonb;
  v_new_data jsonb;
  v_record_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF TG_OP = 'INSERT' THEN
    v_record_id := NEW.id;
    v_new_data := to_jsonb(NEW);
    INSERT INTO public.audit_log (user_id, action, table_name, record_id, new_data)
    VALUES (v_user_id, 'INSERT', TG_TABLE_NAME, v_record_id, v_new_data);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_record_id := NEW.id;
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    IF v_old_data IS DISTINCT FROM v_new_data THEN
      INSERT INTO public.audit_log (user_id, action, table_name, record_id, old_data, new_data)
      VALUES (v_user_id, 'UPDATE', TG_TABLE_NAME, v_record_id, v_old_data, v_new_data);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_record_id := OLD.id;
    v_old_data := to_jsonb(OLD);
    INSERT INTO public.audit_log (user_id, action, table_name, record_id, old_data)
    VALUES (v_user_id, 'DELETE', TG_TABLE_NAME, v_record_id, v_old_data);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$function$;

-- ============================================================
-- 9. PUBLIC SCHEMA HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  select private.get_user_role();
$function$;

CREATE OR REPLACE FUNCTION public.get_user_institute_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  select private.get_user_institute_id();
$function$;

CREATE OR REPLACE FUNCTION public.is_batch_teacher(p_batch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  select private.is_batch_teacher(p_batch_id);
$function$;

CREATE OR REPLACE FUNCTION public.is_institute_admin(inst_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  select private.is_institute_admin(inst_id);
$function$;

CREATE OR REPLACE FUNCTION public.is_parent_of(target_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  select private.is_parent_of(target_id);
$function$;

CREATE OR REPLACE FUNCTION public.get_plan_limits(inst_id uuid)
RETURNS TABLE(plan_id text, max_students integer, max_batches integer, max_teachers integer, announcements_allowed boolean)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  select * from private.get_plan_limits(inst_id);
$function$;

CREATE OR REPLACE FUNCTION public.get_announcements(p_limit integer DEFAULT 20, p_cursor timestamptz DEFAULT NULL, p_cursor_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid, title text, message text, target text, target_batch_id uuid, batch_name text, created_by uuid, created_at timestamptz)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  select * from private.get_announcements(p_limit, p_cursor, p_cursor_id);
$function$;

CREATE OR REPLACE FUNCTION public.get_invite_token(p_token_id uuid)
RETURNS TABLE(id uuid, email text, role text, name text, institute_id uuid, student_id uuid, used boolean, expires_at timestamptz, created_at timestamptz)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  select * from private.get_invite_token(p_token_id);
$function$;

CREATE OR REPLACE FUNCTION public.get_institute_name(p_token_id uuid)
RETURNS text
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  select private.get_institute_name(p_token_id);
$function$;

CREATE OR REPLACE FUNCTION public.check_email_exists(check_email text)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  select private.check_email_exists(check_email);
$function$;

CREATE OR REPLACE FUNCTION public.record_subscription(p_plan_id text, p_payment_id text, p_amount numeric)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  select private.record_subscription(p_plan_id, p_payment_id, p_amount);
$function$;

CREATE OR REPLACE FUNCTION public.soft_delete(p_table text, p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  RETURN private.soft_delete(p_table, p_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  PERFORM private.refresh_analytics();
END;
$function$;

-- ============================================================
-- 10. TRIGGER FUNCTIONS (public)
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_attendance_institute_id()
RETURNS trigger
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.institute_id IS NULL THEN
    SELECT b.institute_id INTO NEW.institute_id
    FROM public.batches b WHERE b.id = NEW.batch_id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_fees_institute_id()
RETURNS trigger
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.institute_id IS NULL THEN
    SELECT b.institute_id INTO NEW.institute_id
    FROM public.batches b WHERE b.id = NEW.batch_id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_action text;
  v_max integer;
  v_bucket timestamptz;
  v_hits integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  v_action := TG_ARGV[0];
  v_max := COALESCE(TG_ARGV[1]::integer, 5);

  v_bucket := date_trunc('minute', now());

  INSERT INTO public.rate_limit_hits (user_id, action, bucket, hits)
  VALUES (auth.uid(), v_action, v_bucket, 1)
  ON CONFLICT (user_id, action, bucket)
  DO UPDATE SET hits = public.rate_limit_hits.hits + 1
  RETURNING hits INTO v_hits;

  IF v_hits > v_max THEN
    RAISE EXCEPTION 'Too many saves - please wait a minute and try again.'
      USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.rate_limit_hits
  WHERE bucket < date_trunc('minute', now()) - interval '1 hour';

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_institute_name_interval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_next timestamptz;
BEGIN
  IF NEW.name IS NOT DISTINCT FROM OLD.name THEN
    RETURN NEW;
  END IF;

  IF OLD.name_changed_at IS NOT NULL
     AND OLD.name_changed_at > now() - interval '14 days' THEN
    v_next := OLD.name_changed_at + interval '14 days';
    RAISE EXCEPTION 'Institute name can only be changed once every 14 days. Try again after %.', to_char(v_next, 'DD Mon YYYY')
      USING ERRCODE = 'P0001';
  END IF;

  NEW.name_changed_at := now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_user_name_interval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_next timestamptz;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> OLD.id THEN
    RETURN NEW;
  END IF;

  IF NEW.full_name IS NOT DISTINCT FROM OLD.full_name THEN
    RETURN NEW;
  END IF;

  IF OLD.full_name_changed_at IS NOT NULL
     AND OLD.full_name_changed_at > now() - interval '14 days' THEN
    v_next := OLD.full_name_changed_at + interval '14 days';
    RAISE EXCEPTION 'Name can only be changed once every 14 days. Try again after %.', to_char(v_next, 'DD Mon YYYY')
      USING ERRCODE = 'P0001';
  END IF;

  NEW.full_name_changed_at := now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.users_guard_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_actor_role text;
  v_actor_institute uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role, institute_id INTO v_actor_role, v_actor_institute
  FROM public.users
  WHERE id = auth.uid();

  IF v_actor_role = 'admin' AND NEW.institute_id = v_actor_institute THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You can only create your own profile.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.role = 'admin' THEN
    IF EXISTS (
      SELECT 1 FROM public.institutes i
      WHERE i.id = NEW.institute_id AND i.owner_id = auth.uid()
    ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Cannot create an admin profile for this institute.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.invite_tokens t
    WHERE t.email = NEW.email
      AND t.role = NEW.role
      AND t.institute_id = NEW.institute_id
      AND t.used = false
      AND t.expires_at > now()
      AND lower(t.email) = lower(coalesce(auth.jwt()->>'email', ''))
  ) THEN
    RAISE EXCEPTION 'No valid invitation matches this profile.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.users_prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_actor_role text;
  v_actor_institute uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS NOT DISTINCT FROM OLD.role
     AND NEW.institute_id IS NOT DISTINCT FROM OLD.institute_id THEN
    RETURN NEW;
  END IF;

  IF NEW.institute_id IS DISTINCT FROM OLD.institute_id THEN
    RAISE EXCEPTION 'Changing a user''s institute is not allowed.'
      USING ERRCODE = '42501';
  END IF;

  SELECT role, institute_id INTO v_actor_role, v_actor_institute
  FROM public.users
  WHERE id = auth.uid();

  IF v_actor_role <> 'admin'
     OR v_actor_institute IS DISTINCT FROM OLD.institute_id THEN
    RAISE EXCEPTION 'Only an admin can change a user''s role.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_parent_consent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.parent_consent IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Parent/guardian consent is required before adding a student (DPDP Act, 2023).';
  END IF;
  IF NEW.parent_consent_at IS NULL THEN
    NEW.parent_consent_at := now();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_student_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_count INT;
  v_limits RECORD;
BEGIN
  SELECT * INTO v_limits FROM public.get_plan_limits(NEW.institute_id);
  SELECT COUNT(*) INTO v_count FROM public.students WHERE institute_id = NEW.institute_id AND deleted_at IS NULL;

  IF v_count >= v_limits.max_students THEN
    RAISE EXCEPTION 'Student limit reached (% plan, max % students). Upgrade to add more.', v_limits.plan_id, v_limits.max_students;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_batch_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_count INT;
  v_limits RECORD;
BEGIN
  SELECT * INTO v_limits FROM public.get_plan_limits(NEW.institute_id);
  SELECT COUNT(*) INTO v_count FROM public.batches WHERE institute_id = NEW.institute_id AND deleted_at IS NULL;

  IF v_count >= v_limits.max_batches THEN
    RAISE EXCEPTION 'Batch limit reached (% plan, max % batches). Upgrade to add more.', v_limits.plan_id, v_limits.max_batches;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_teacher_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_count INT;
  v_limits RECORD;
BEGIN
  IF NEW.role != 'teacher' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_limits FROM public.get_plan_limits(NEW.institute_id);
  SELECT COUNT(*) INTO v_count FROM public.users WHERE institute_id = NEW.institute_id AND role = 'teacher' AND deleted_at IS NULL;

  IF v_count >= v_limits.max_teachers THEN
    RAISE EXCEPTION 'Teacher limit reached (% plan, max % teachers). Upgrade to invite more.', v_limits.plan_id, v_limits.max_teachers;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_invite_teacher_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_count INT;
  v_limits RECORD;
BEGIN
  IF NEW.role != 'teacher' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_limits FROM public.get_plan_limits(NEW.institute_id);

  SELECT COUNT(*) INTO v_count
  FROM (
    SELECT 1 FROM public.users WHERE institute_id = NEW.institute_id AND role = 'teacher' AND deleted_at IS NULL
    UNION ALL
    SELECT 1 FROM public.invite_tokens
    WHERE institute_id = NEW.institute_id
      AND role = 'teacher'
      AND used = false
      AND expires_at > now()
  ) t;

  IF v_count >= v_limits.max_teachers THEN
    RAISE EXCEPTION 'Teacher limit reached (% plan, max % teachers). Upgrade to invite more.', v_limits.plan_id, v_limits.max_teachers;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_announcement_plan()
RETURNS trigger
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_limits record;
BEGIN
  SELECT * INTO v_limits FROM private.get_plan_limits(
    (SELECT institute_id FROM public.institutes WHERE id = NEW.institute_id)
  );

  IF NOT v_limits.announcements_allowed THEN
    RAISE EXCEPTION 'Announcements require a paid plan.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_plan_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
declare
  v_inst_id uuid;
  v_limits record;
  v_count bigint;
  v_table text;
begin
  select institute_id into v_inst_id
  from users where id = auth.uid();

  if v_inst_id is null then
    return new;
  end if;

  select * into v_limits
  from get_plan_limits(v_inst_id);

  v_table := TG_TABLE_NAME;

  if v_table = 'students' then
    if v_limits.max_students > 20 then
      return new;
    end if;
    select count(*) into v_count
    from students
    where institute_id = v_inst_id and deleted_at is null;

    if v_count >= v_limits.max_students then
      raise exception 'student_limit_reached: Free plan allows % students. Upgrade to add more.', v_limits.max_students
        using errcode = 'check_violation';
    end if;

  elsif v_table = 'batches' then
    if v_limits.max_batches > 1 then
      return new;
    end if;
    select count(*) into v_count
    from batches
    where institute_id = v_inst_id and deleted_at is null;

    if v_count >= v_limits.max_batches then
      raise exception 'batch_limit_reached: Free plan allows % batch. Upgrade to add more.', v_limits.max_batches
        using errcode = 'check_violation';
    end if;

  elsif v_table = 'users' and new.role = 'teacher' then
    if v_limits.max_teachers > 1 then
      return new;
    end if;
    select count(*) into v_count
    from users
    where institute_id = v_inst_id and role = 'teacher' and deleted_at is null;

    if v_count >= v_limits.max_teachers then
      raise exception 'teacher_limit_reached: Free plan allows % teacher. Upgrade to add more.', v_limits.max_teachers
        using errcode = 'check_violation';
    end if;

  elsif v_table = 'announcements' then
    if v_limits.announcements_allowed then
      return new;
    end if;
    raise exception 'announcements_not_allowed: Free plan does not include announcements. Upgrade to Basic.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$function$;

-- ============================================================
-- 11. RLS
-- ============================================================

ALTER TABLE public.institutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_student_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institute_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Institutes
CREATE POLICY institutes_admin_all ON public.institutes FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY institutes_read_own ON public.institutes FOR SELECT USING (id = public.get_user_institute_id());

-- Users
CREATE POLICY users_self_insert ON public.users FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY users_self_read ON public.users FOR SELECT USING (id = auth.uid());
CREATE POLICY users_self_update ON public.users FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "users update own onboarding" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY users_admin_read_institute ON public.users FOR SELECT USING (public.get_user_role() = 'admin' AND institute_id = public.get_user_institute_id());
CREATE POLICY users_admin_update_institute ON public.users FOR UPDATE USING (public.get_user_role() = 'admin' AND institute_id = public.get_user_institute_id()) WITH CHECK (public.get_user_role() = 'admin' AND institute_id = public.get_user_institute_id());
CREATE POLICY users_admin_insert ON public.users FOR INSERT WITH CHECK (public.get_user_role() = 'admin' AND institute_id = public.get_user_institute_id());
CREATE POLICY users_admin_delete ON public.users FOR DELETE USING (public.get_user_role() = 'admin' AND institute_id = public.get_user_institute_id());

-- Batches
CREATE POLICY batches_admin_all ON public.batches FOR ALL USING (institute_id = public.get_user_institute_id() AND public.get_user_role() = 'admin') WITH CHECK (institute_id = public.get_user_institute_id() AND public.get_user_role() = 'admin');
CREATE POLICY batches_teacher_read ON public.batches FOR SELECT USING (teacher_id = auth.uid());
CREATE POLICY batches_teacher_update ON public.batches FOR UPDATE USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

-- Students
CREATE POLICY students_admin_all ON public.students FOR ALL USING (institute_id = public.get_user_institute_id() AND public.get_user_role() = 'admin') WITH CHECK (institute_id = public.get_user_institute_id() AND public.get_user_role() = 'admin');
CREATE POLICY students_parent_read ON public.students FOR SELECT USING (public.is_parent_of(id));
CREATE POLICY students_teacher_read ON public.students FOR SELECT USING (public.get_user_role() = 'teacher' AND EXISTS (SELECT 1 FROM public.student_batches sb JOIN public.batches b ON b.id = sb.batch_id WHERE sb.student_id = students.id AND b.teacher_id = auth.uid()));

-- Student Batches
CREATE POLICY student_batches_admin_all ON public.student_batches FOR ALL USING (public.get_user_role() = 'admin' AND EXISTS (SELECT 1 FROM public.batches b WHERE b.id = student_batches.batch_id AND b.institute_id = public.get_user_institute_id())) WITH CHECK (public.get_user_role() = 'admin' AND EXISTS (SELECT 1 FROM public.batches b WHERE b.id = student_batches.batch_id AND b.institute_id = public.get_user_institute_id()));
CREATE POLICY student_batches_teacher_read ON public.student_batches FOR SELECT USING (public.is_batch_teacher(batch_id));
CREATE POLICY student_batches_parent_read ON public.student_batches FOR SELECT USING (public.is_parent_of(student_id));

-- Fees
CREATE POLICY fees_admin_all ON public.fees FOR ALL USING (public.get_user_role() = 'admin' AND institute_id = public.get_user_institute_id()) WITH CHECK (public.get_user_role() = 'admin' AND institute_id = public.get_user_institute_id());
CREATE POLICY fees_teacher_read ON public.fees FOR SELECT USING (public.get_user_role() = 'teacher' AND EXISTS (SELECT 1 FROM public.batches b WHERE b.id = fees.batch_id AND b.teacher_id = auth.uid()));
CREATE POLICY fees_parent_read ON public.fees FOR SELECT USING (EXISTS (SELECT 1 FROM public.student_batches sb WHERE sb.batch_id = fees.batch_id AND public.is_parent_of(sb.student_id)));

-- Payments
CREATE POLICY payments_admin_all ON public.payments FOR ALL USING (public.get_user_role() = 'admin' AND ((student_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = payments.student_id AND s.institute_id = public.get_user_institute_id())) OR (student_id IS NULL AND institute_id = public.get_user_institute_id()))) WITH CHECK (public.get_user_role() = 'admin' AND ((student_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = payments.student_id AND s.institute_id = public.get_user_institute_id())) OR (student_id IS NULL AND institute_id = public.get_user_institute_id())));
CREATE POLICY payments_parent_read ON public.payments FOR SELECT USING (public.is_parent_of(student_id));
CREATE POLICY payments_parent_pay ON public.payments FOR UPDATE USING (public.is_parent_of(student_id)) WITH CHECK (public.is_parent_of(student_id));

-- Attendance
CREATE POLICY attendance_admin_all ON public.attendance FOR ALL USING (public.get_user_role() = 'admin' AND institute_id = public.get_user_institute_id()) WITH CHECK (public.get_user_role() = 'admin' AND institute_id = public.get_user_institute_id());
CREATE POLICY attendance_teacher_read ON public.attendance FOR SELECT USING ((public.get_user_role() = 'teacher' AND public.is_batch_teacher(batch_id)) OR (public.get_user_role() = 'admin' AND institute_id = public.get_user_institute_id()));
CREATE POLICY attendance_teacher_insert ON public.attendance FOR INSERT WITH CHECK (public.get_user_role() = 'teacher' AND public.is_batch_teacher(batch_id) AND marked_by = auth.uid() AND institute_id = public.get_user_institute_id());
CREATE POLICY attendance_teacher_update ON public.attendance FOR UPDATE USING (public.get_user_role() = 'teacher' AND public.is_batch_teacher(batch_id)) WITH CHECK (public.get_user_role() = 'teacher' AND public.is_batch_teacher(batch_id));
CREATE POLICY attendance_parent_read ON public.attendance FOR SELECT USING (public.is_parent_of(student_id));

-- Announcements
CREATE POLICY announcements_admin_all ON public.announcements FOR ALL USING (institute_id = public.get_user_institute_id() AND public.get_user_role() = 'admin') WITH CHECK (institute_id = public.get_user_institute_id() AND public.get_user_role() = 'admin');
CREATE POLICY announcements_teacher_insert ON public.announcements FOR INSERT WITH CHECK (public.get_user_role() = 'teacher' AND institute_id = public.get_user_institute_id());
CREATE POLICY announcements_teacher_read ON public.announcements FOR SELECT USING (public.get_user_role() = 'teacher' AND institute_id = public.get_user_institute_id());
CREATE POLICY announcements_teacher_delete ON public.announcements FOR DELETE USING (public.get_user_role() = 'teacher' AND institute_id = public.get_user_institute_id() AND created_by = auth.uid());
CREATE POLICY announcements_parent_read ON public.announcements FOR SELECT USING (public.get_user_role() = 'parent' AND institute_id = public.get_user_institute_id());

-- Subscriptions
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions FOR SELECT USING (user_id = auth.uid());

-- Parent Student Links
CREATE POLICY psl_admin_all ON public.parent_student_links FOR ALL USING (institute_id = public.get_user_institute_id() AND public.get_user_role() = 'admin') WITH CHECK (institute_id = public.get_user_institute_id() AND public.get_user_role() = 'admin');
CREATE POLICY psl_parent_read ON public.parent_student_links FOR SELECT USING (parent_id = auth.uid());
CREATE POLICY psl_parent_self_insert ON public.parent_student_links FOR INSERT WITH CHECK (parent_id = auth.uid() AND public.get_user_role() = 'parent' AND institute_id = public.get_user_institute_id() AND private.student_in_institute(student_id, institute_id));

-- Invite Tokens
CREATE POLICY invite_admin_all ON public.invite_tokens FOR ALL USING (institute_id = public.get_user_institute_id() AND public.get_user_role() = 'admin') WITH CHECK (institute_id = public.get_user_institute_id() AND public.get_user_role() = 'admin');

-- Institute Settings
CREATE POLICY institute_settings_admin_select ON public.institute_settings FOR SELECT USING (public.get_user_role() = 'admin' AND institute_id = public.get_user_institute_id());
CREATE POLICY institute_settings_admin_insert ON public.institute_settings FOR INSERT WITH CHECK (public.get_user_role() = 'admin' AND institute_id = public.get_user_institute_id());
CREATE POLICY institute_settings_admin_update ON public.institute_settings FOR UPDATE USING (public.get_user_role() = 'admin' AND institute_id = public.get_user_institute_id()) WITH CHECK (public.get_user_role() = 'admin' AND institute_id = public.get_user_institute_id());

-- Rate Limit Hits
CREATE POLICY "no direct access - internal only" ON public.rate_limit_hits FOR ALL USING (false) WITH CHECK (false);

-- Audit Log
CREATE POLICY audit_log_admin_read ON public.audit_log FOR SELECT USING (public.get_user_role() = 'admin' AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = audit_log.user_id AND u.institute_id = public.get_user_institute_id()));
CREATE POLICY audit_log_no_direct_insert ON public.audit_log FOR INSERT WITH CHECK (false);

-- Waitlist
CREATE POLICY "Anyone can insert" ON public.waitlist FOR INSERT WITH CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' AND char_length(email) >= 3 AND char_length(email) <= 320);

-- ============================================================
-- 12. TRIGGERS
-- ============================================================

-- updated_at triggers (BEFORE UPDATE on each table)
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.batches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.fees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.institutes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Institute name interval
CREATE TRIGGER trg_enforce_institute_name_interval BEFORE UPDATE ON public.institutes FOR EACH ROW EXECUTE FUNCTION public.enforce_institute_name_interval();

-- User name interval
CREATE TRIGGER trg_enforce_user_name_interval BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.enforce_user_name_interval();

-- User guard insert
CREATE TRIGGER trg_users_guard_insert BEFORE INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.users_guard_insert();

-- User role escalation prevention
CREATE TRIGGER trg_users_prevent_role_escalation BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.users_prevent_role_escalation();

-- Parent consent
CREATE TRIGGER trg_enforce_parent_consent BEFORE INSERT ON public.students FOR EACH ROW EXECUTE FUNCTION public.enforce_parent_consent();

-- Plan limit triggers
CREATE TRIGGER trg_enforce_plan_limit_students BEFORE INSERT ON public.students FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limit();
CREATE TRIGGER trg_enforce_plan_limit_batches BEFORE INSERT ON public.batches FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limit();
CREATE TRIGGER trg_enforce_plan_limit_announcements BEFORE INSERT ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limit();
CREATE TRIGGER trg_enforce_plan_limit_users BEFORE INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limit();

-- Legacy plan limit triggers (can coexist with enforce_plan_limit)
CREATE TRIGGER trg_check_student_limit BEFORE INSERT ON public.students FOR EACH ROW EXECUTE FUNCTION public.check_student_limit();
CREATE TRIGGER trg_check_batch_limit BEFORE INSERT ON public.batches FOR EACH ROW EXECUTE FUNCTION public.check_batch_limit();
CREATE TRIGGER trg_check_teacher_limit BEFORE INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.check_teacher_limit();
CREATE TRIGGER trg_check_invite_teacher_limit BEFORE INSERT ON public.invite_tokens FOR EACH ROW EXECUTE FUNCTION public.check_invite_teacher_limit();

-- Announcement plan gate
CREATE TRIGGER check_announcement_plan BEFORE INSERT ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.check_announcement_plan();

-- Rate limit triggers
CREATE TRIGGER trg_rate_limit_institutes BEFORE DELETE ON public.institutes FOR EACH ROW EXECUTE FUNCTION public.enforce_rate_limit('delete_institute', '3');
CREATE TRIGGER trg_rate_limit_institute_settings BEFORE INSERT ON public.institute_settings FOR EACH ROW EXECUTE FUNCTION public.enforce_rate_limit('create_settings', '3');
CREATE TRIGGER trg_rate_limit_users_profile BEFORE DELETE ON public.users FOR EACH ROW EXECUTE FUNCTION public.enforce_rate_limit('delete_user', '3');
CREATE TRIGGER trg_rate_limit_announcements BEFORE INSERT ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.enforce_rate_limit('create_announcement', '5');

-- Auto-set institute_id
CREATE TRIGGER set_institute_id BEFORE INSERT ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.set_attendance_institute_id();
CREATE TRIGGER set_institute_id BEFORE INSERT ON public.fees FOR EACH ROW EXECUTE FUNCTION public.set_fees_institute_id();

-- Audit triggers
CREATE TRIGGER audit_students AFTER INSERT ON public.students FOR EACH ROW EXECUTE FUNCTION private.audit_trigger_func();
CREATE TRIGGER audit_batches AFTER INSERT ON public.batches FOR EACH ROW EXECUTE FUNCTION private.audit_trigger_func();
CREATE TRIGGER audit_payments AFTER INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION private.audit_trigger_func();
CREATE TRIGGER audit_users AFTER INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION private.audit_trigger_func();
CREATE TRIGGER audit_announcements AFTER INSERT ON public.announcements FOR EACH ROW EXECUTE FUNCTION private.audit_trigger_func();
