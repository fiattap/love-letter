alter table public.letters
  add column if not exists cycle_key text;

create index if not exists letters_cycle_key_idx
  on public.letters (cycle_key);

-- Backfill cycle_key from prompt month mapping when available.
update public.letters as l
set cycle_key = p.month_key
from public.prompts as p
where l.cycle_key is null
  and l.prompt = p.prompt;

-- If prompt text does not map, use currently active prompt month.
update public.letters as l
set cycle_key = p.month_key
from public.prompts as p
where l.cycle_key is null
  and p.is_active = true;

-- Current test fallback cycle.
update public.letters
set cycle_key = '2026-07'
where cycle_key is null;

-- Backfill couple_id where possible so each letter is tied to one couple.
update public.letters as l
set couple_id = c.id
from public.couples as c
where l.couple_id is null
  and (
    l.writer_email = c.partner_one_email
    or l.writer_email = c.partner_two_email
  );
