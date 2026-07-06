-- Marketability report: one per manuscript. Stores the uploaded report's text
-- and an AI summary of its key components + key issues, which also feeds the
-- query-letter generator as trusted, author-provided positioning material.
create table if not exists marketability_reports (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references manuscripts(id) on delete cascade,
  file_name text,
  raw_text text not null,
  summary text,
  provider text check (provider in ('openai','anthropic')),
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketability_reports_manuscript_idx
  on marketability_reports(manuscript_id);
