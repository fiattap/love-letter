-- Subscriptions are billed per couple, so the subscription state lives on the
-- couple (not the individual member). This lets both partners see "premium" and
-- prevents the second partner from paying again.

alter table public.couples
  add column if not exists subscription_status text not null default 'free',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;
