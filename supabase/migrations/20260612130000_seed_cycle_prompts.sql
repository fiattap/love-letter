-- Seed guided prompts for upcoming cycles so the date-driven prompt selection
-- always has content. Inserts only months that don't already exist, so any
-- prompt you've already written is preserved.

insert into public.prompts (month_key, title, prompt, is_active)
select v.month_key, v.title, v.prompt, false
from (values
  ('2026-06', 'June Love Letter', 'What first made you feel safe with me?'),
  ('2026-07', 'July Love Letter', 'What is something you think I don''t realize you appreciate about me?'),
  ('2026-08', 'August Love Letter', 'When did you most feel loved by me this month?'),
  ('2026-09', 'September Love Letter', 'What small, everyday moment with me do you treasure most?'),
  ('2026-10', 'October Love Letter', 'What is something you''ve never told me but want me to know?'),
  ('2026-11', 'November Love Letter', 'What about us are you most grateful for right now?'),
  ('2026-12', 'December Love Letter', 'What memory from this year together do you want to keep forever?'),
  ('2027-01', 'January Love Letter', 'What do you hope we build together this year?'),
  ('2027-02', 'February Love Letter', 'What made you fall for me — and what makes you stay?'),
  ('2027-03', 'March Love Letter', 'How have I changed you for the better?'),
  ('2027-04', 'April Love Letter', 'What dream of yours do you want me to be part of?'),
  ('2027-05', 'May Love Letter', 'When do you feel most like yourself around me?'),
  ('2027-06', 'June Love Letter', 'What is something I do that quietly makes your day better?'),
  ('2027-07', 'July Love Letter', 'What are you most looking forward to in our future together?')
) as v(month_key, title, prompt)
where not exists (
  select 1 from public.prompts p where p.month_key = v.month_key
);
