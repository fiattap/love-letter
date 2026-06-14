-- Speeds up the dashboard / reveal / write lookups.
-- Most email lookups use ILIKE (case-insensitive), which a plain btree index
-- cannot serve, so we use trigram (pg_trgm) GIN indexes for those columns and
-- a composite btree for the letter status filter.

create extension if not exists pg_trgm;

-- members: looked up by email (ILIKE) on every dashboard / write / reveal load
create index if not exists idx_members_email_trgm
  on public.members using gin (email gin_trgm_ops);

-- couples: looked up by either partner email (ILIKE) to find the pairing
create index if not exists idx_couples_partner_one_email_trgm
  on public.couples using gin (partner_one_email gin_trgm_ops);

create index if not exists idx_couples_partner_two_email_trgm
  on public.couples using gin (partner_two_email gin_trgm_ops);

-- letters: filtered by (cycle_key, status) and matched by writer_email
create index if not exists idx_letters_cycle_status
  on public.letters (cycle_key, status);

create index if not exists idx_letters_writer_email_trgm
  on public.letters using gin (writer_email gin_trgm_ops);

-- prompts: the active prompt is fetched by is_active ordered by created_at
create index if not exists idx_prompts_active_created
  on public.prompts (is_active, created_at desc);
