-- Premium fulfillment: store each couple's mailing address (captured at Stripe
-- Checkout) and track whether the printed letters were mailed for each cycle.

alter table public.couples
  add column if not exists shipping_name text,
  add column if not exists shipping_address jsonb;

create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  cycle_key text not null,
  status text not null default 'pending',
  shipped_at timestamptz,
  created_at timestamptz not null default now(),
  unique (couple_id, cycle_key)
);

create index if not exists shipments_cycle_key_idx on public.shipments (cycle_key);
