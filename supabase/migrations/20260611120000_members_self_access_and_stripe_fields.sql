alter table public.members
  add column if not exists subscription_status text not null default 'free',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

grant select, update on table public.members to authenticated;
grant insert on table public.members to anon, authenticated;

alter table public.members enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'members'
      and policyname = 'members_select_own'
  ) then
    create policy members_select_own
      on public.members
      for select
      to authenticated
      using (lower(trim(email)) = lower(trim(auth.email())));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'members'
      and policyname = 'members_update_own'
  ) then
    create policy members_update_own
      on public.members
      for update
      to authenticated
      using (lower(trim(email)) = lower(trim(auth.email())))
      with check (lower(trim(email)) = lower(trim(auth.email())));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'members'
      and policyname = 'members_insert_public'
  ) then
    create policy members_insert_public
      on public.members
      for insert
      to anon, authenticated
      with check (true);
  end if;
end $$;
