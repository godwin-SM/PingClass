-- Parent/guardian consent record for students under 18 (DPDP Act, 2023).
-- The enrolling institute is the Data Fiduciary; PingClass stores the consent
-- record it captures at enrollment time (declaration + who + when).

alter table public.students
  add column if not exists parent_consent boolean not null default false,
  add column if not exists parent_consent_by text,
  add column if not exists parent_consent_at timestamptz;
