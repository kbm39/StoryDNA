-- Revision re-check history: each row is one AI pass over a revised manuscript,
-- recording the updated grade and per-issue verdicts.
create table if not exists revision_checks (
  id                uuid primary key default gen_random_uuid(),
  manuscript_id     uuid not null references manuscripts(id) on delete cascade,
  provider          text not null check (provider in ('openai', 'anthropic')),
  model             text,
  grade             text,
  summary           text,
  resolved_count    integer not null default 0,
  outstanding_count integer not null default 0,
  issue_verdicts    jsonb,
  created_at        timestamptz not null default now()
);
create index if not exists revision_checks_manuscript_id_idx on revision_checks(manuscript_id);
