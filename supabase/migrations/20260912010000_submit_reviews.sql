-- Public landing-page review capture. Rows stay hidden (status='pending')
-- until an admin approves them. The table is deliberately NOT exposed through
-- the Data API (no anon/authenticated grants): the submit-review edge function
-- is the only writer, and its per-IP rate limit keeps bot spam out of the
-- moderation queue.
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  author_name text not null check (char_length(trim(author_name)) between 2 and 60),
  quote text not null check (char_length(trim(quote)) between 10 and 1000),
  rating smallint not null default 5 check (rating between 1 and 5),
  institute text check (institute is null or char_length(trim(institute)) <= 80),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.reviews enable row level security;
alter table public.reviews force row level security;

grant select, insert, update, delete on public.reviews to service_role;