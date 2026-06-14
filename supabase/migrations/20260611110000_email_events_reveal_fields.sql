alter table public.email_events
  add column if not exists couple_id bigint,
  add column if not exists recipient_email text,
  add column if not exists provider_message_id text;

update public.email_events
set recipient_email = email
where recipient_email is null;

create index if not exists email_events_reveal_cycle_idx
  on public.email_events (cycle_key, event_type, status);

create index if not exists email_events_reveal_recipient_idx
  on public.email_events (recipient_email, event_type, cycle_key, status);
