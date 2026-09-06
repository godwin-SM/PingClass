-- Distinguish how parent/guardian consent was captured (DPDP Act, 2023 s.9):
--   'manual'          - enrolled by the institute as a declaration (admin checkbox)
--   'verified_invite' - parent proved control of their email via the invite OTP flow
--                       (stamped server-side by the mark-token-used edge function)
alter table public.students
  add column if not exists parent_consent_method text
  check (parent_consent_method is null or parent_consent_method in ('manual', 'verified_invite'));

-- Existing consent records were captured via the enrollment declaration.
update public.students
  set parent_consent_method = 'manual'
  where parent_consent = true and parent_consent_method is null;