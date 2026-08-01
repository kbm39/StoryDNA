-- Amendment 002 · Progressive Editorial Understanding
-- Additive migration. Does not alter Phase 1A or 1B-a tables.

alter table public.editorial_understandings
  add column if not exists understanding_quality jsonb not null default '{}'::jsonb,
  add column if not exists synthesis_artifacts jsonb not null default '[]'::jsonb;
