-- Support inbox for the CEO console: mirrors inbound mail to support@pingclass.in
-- (forwarded by ImprovMX into the owner's Gmail, synced by the
-- sync-support-mail edge function using the Gmail API).
-- Server-only table: not exposed to anon/authenticated.

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  gmail_message_id text not null unique,
  gmail_thread_id text,
  sender_name text,
  sender_email text not null,
  to_list text,
  subject text,
  snippet text,
  body text,
  message_id_header text,
  in_reply_to text,
  date timestamptz,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.support_messages enable row level security;

create index support_messages_date_idx on public.support_messages (date desc);
create index support_messages_read_idx on public.support_messages (read);

grant select, insert, update, delete on public.support_messages to service_role;