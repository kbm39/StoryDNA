-- Manuscript review app — initial schema
-- Single-user / local app: RLS is intentionally left off. The server uses the
-- Supabase service-role key. Add auth + RLS later if this ever leaves localhost.

-- updated_at helper
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 1. Manuscripts (Phase 1) ----------------------------------------------------
create table if not exists manuscripts (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  original_filename text not null,
  storage_path      text not null,
  file_size         bigint,
  word_count        integer,
  extracted_text    text,
  status            text not null default 'uploaded',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists manuscripts_set_updated_at on manuscripts;
create trigger manuscripts_set_updated_at
  before update on manuscripts
  for each row execute function set_updated_at();

-- 2. Reviews (Phase 2: dual editorial reviews) --------------------------------
create table if not exists reviews (
  id            uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references manuscripts(id) on delete cascade,
  provider      text not null check (provider in ('openai', 'anthropic')),
  perspective   text not null check (perspective in ('commercial', 'craft')),
  model         text,
  content       text not null,
  metadata      jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists reviews_manuscript_id_idx on reviews(manuscript_id);

-- 3. Issues checklist (Phase 3) -----------------------------------------------
create table if not exists issues (
  id              uuid primary key default gen_random_uuid(),
  manuscript_id   uuid not null references manuscripts(id) on delete cascade,
  review_id       uuid references reviews(id) on delete set null,
  title           text not null,
  description     text,
  category        text,
  source_provider text check (source_provider in ('openai', 'anthropic')),
  status          text not null default 'outstanding' check (status in ('outstanding', 'resolved')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists issues_manuscript_id_idx on issues(manuscript_id);

drop trigger if exists issues_set_updated_at on issues;
create trigger issues_set_updated_at
  before update on issues
  for each row execute function set_updated_at();

-- 4. Fix suggestions per issue (Phases 4-5) -----------------------------------
create table if not exists suggestions (
  id         uuid primary key default gen_random_uuid(),
  issue_id   uuid not null references issues(id) on delete cascade,
  provider   text not null check (provider in ('openai', 'anthropic')),
  model      text,
  content    text not null,
  applied    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists suggestions_issue_id_idx on suggestions(issue_id);

-- 5. Scene brainstorming (Phase 6) --------------------------------------------
create table if not exists brainstorms (
  id            uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references manuscripts(id) on delete cascade,
  prompt        text not null,
  provider      text not null check (provider in ('openai', 'anthropic')),
  model         text,
  content       text not null,
  selected      boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists brainstorms_manuscript_id_idx on brainstorms(manuscript_id);

-- Storage bucket for the original .docx files (private) ------------------------
insert into storage.buckets (id, name, public)
values ('manuscripts', 'manuscripts', false)
on conflict (id) do nothing;
