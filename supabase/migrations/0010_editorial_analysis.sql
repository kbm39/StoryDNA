-- Editorial analysis: upload a human editor's analysis, split it into discrete
-- comments, and have OpenAI + Claude each weigh in (agree / disagree / partial)
-- on every comment. Each comment can then drive the existing suggestion → edit
-- flow, or be dropped into the .docx as a Word margin comment.

-- One uploaded analysis per manuscript (mirrors marketability_reports).
create table if not exists editorial_analyses (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references manuscripts(id) on delete cascade,
  file_name text,
  raw_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists editorial_analyses_manuscript_idx
  on editorial_analyses(manuscript_id);

-- The discrete comments parsed out of an analysis.
create table if not exists editorial_comments (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references editorial_analyses(id) on delete cascade,
  manuscript_id uuid not null references manuscripts(id) on delete cascade,
  ordinal int not null default 0,
  quote text,            -- the passage the editor is commenting on (if any)
  comment text not null, -- the editor's note
  category text,
  created_at timestamptz not null default now()
);

create index if not exists editorial_comments_analysis_idx
  on editorial_comments(analysis_id);
create index if not exists editorial_comments_manuscript_idx
  on editorial_comments(manuscript_id);

-- Each model's stance on a single comment. One row per (comment, provider).
create table if not exists comment_assessments (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references editorial_comments(id) on delete cascade,
  provider text not null check (provider in ('openai','anthropic')),
  model text,
  stance text not null check (stance in ('agree','disagree','partial')),
  reasoning text,
  created_at timestamptz not null default now(),
  unique (comment_id, provider)
);

create index if not exists comment_assessments_comment_idx
  on comment_assessments(comment_id);

-- Let the existing suggestions table also hang off an editorial comment, so the
-- suggestion → propose-edits → apply flow is reused unchanged. A suggestion
-- belongs to EITHER an issue or a comment, never both and never neither.
alter table suggestions
  alter column issue_id drop not null;

alter table suggestions
  add column if not exists comment_id uuid references editorial_comments(id) on delete cascade;

create index if not exists suggestions_comment_idx on suggestions(comment_id);

alter table suggestions drop constraint if exists suggestions_one_parent;
alter table suggestions
  add constraint suggestions_one_parent
  check ((issue_id is not null) <> (comment_id is not null));
