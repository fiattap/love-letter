create table if not exists public.prompts (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  month_key text not null,
  title text not null,
  prompt text not null,
  is_active boolean not null default false
);

create unique index if not exists prompts_month_key_key
  on public.prompts (month_key);

create unique index if not exists prompts_one_active_key
  on public.prompts (is_active)
  where is_active = true;

create index if not exists prompts_active_created_idx
  on public.prompts (is_active, created_at desc);

insert into public.prompts (month_key, title, prompt, is_active)
values (
  '2026-07',
  'July Love Letter',
  'What is something you think I don''t realize you appreciate about me?',
  true
)
on conflict (month_key) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  is_active = excluded.is_active;
