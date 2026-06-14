alter table public.members
  add column if not exists physical_interest boolean not null default false;

alter table public.members
  add column if not exists delivery_type text not null default 'digital';

alter table public.members
  drop constraint if exists members_delivery_type_check;

alter table public.members
  add constraint members_delivery_type_check
  check (delivery_type in ('digital', 'physical'));
