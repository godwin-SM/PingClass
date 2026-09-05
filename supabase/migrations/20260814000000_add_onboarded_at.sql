-- First-login onboarding: track when a user completes (or skips) the intro tour.
-- The runtime feature works without this (localStorage fallback), but this makes
-- the "seen" state follow the user across devices and browsers.

alter table public.users
  add column if not exists onboarded_at timestamptz;

-- Grant UPDATE limited to the onboarded_at column only, so a user can flag their
-- own profile as onboarded without being able to change other columns (e.g. role).
grant update (onboarded_at) on public.users to authenticated;

drop policy if exists "users update own onboarding" on public.users;
create policy "users update own onboarding" on public.users
  for update
  using (auth.uid() = id);
