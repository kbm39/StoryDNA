-- Manuscript Intake (the short StoryDNA interview shown before Story Understanding).
-- One record per manuscript, plus an author-level profile (remembered feedback
-- style / optimization) and per-series defaults that prefill future books.

create table if not exists manuscript_intake (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references manuscripts(id) on delete cascade,
  relation text check (relation in ('standalone', 'existing_series', 'new_series')),
  series_id uuid references series(id) on delete set null,
  series_name text,
  book_number int,
  order_type text,
  published_order int,
  story_order int,
  manuscript_type text,
  manuscript_stage text,
  load_canon boolean not null default false,
  load_characters boolean not null default false,
  load_timeline boolean not null default false,
  load_story_memory boolean not null default false,
  load_author_intent boolean not null default false,
  load_editorial_decisions boolean not null default false,
  load_reviewer_feedback boolean not null default false,
  objectives text[] not null default '{}',
  optimization text,
  feedback_style text[] not null default '{}',
  recommend_specialists boolean not null default true,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (manuscript_id)
);

create index if not exists manuscript_intake_manuscript_idx on manuscript_intake(manuscript_id);

-- Single-user author profile: remembered feedback style + optimization default.
create table if not exists author_profile (
  id text primary key default 'default',
  feedback_style text[] not null default '{}',
  optimization text,
  updated_at timestamptz not null default now()
);

-- Per-series defaults (from "Save as default for this series").
alter table series add column if not exists default_objectives text[] not null default '{}';
alter table series add column if not exists default_optimization text;
alter table series add column if not exists default_feedback_style text[] not null default '{}';
alter table series add column if not exists default_recommend_specialists boolean;
