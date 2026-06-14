create extension if not exists pgcrypto;

alter table public.members
  add column if not exists delivery_type text not null default 'digital';

alter table public.members
  drop constraint if exists members_delivery_type_check;

alter table public.members
  add constraint members_delivery_type_check
  check (delivery_type in ('digital', 'physical'));

create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null,
  event_type text not null,
  cycle_key text not null,
  status text not null default 'sent',
  resend_id text,
  error text,
  error_message text
);

create index if not exists email_events_lookup_idx
  on public.email_events (email, event_type, cycle_key, status);

create unique index if not exists email_events_unique_sent_idx
  on public.email_events (email, event_type, cycle_key)
  where status = 'sent';
