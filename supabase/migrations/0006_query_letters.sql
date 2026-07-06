-- Generated query letters (one per agent), built from a manuscript + agent data.
create table if not exists query_letters (
  id            uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references manuscripts(id) on delete cascade,
  agent_id      text,
  agent_name    text,
  agency        text,
  provider      text not null check (provider in ('openai', 'anthropic')),
  model         text,
  content       text not null,
  created_at    timestamptz not null default now()
);
create index if not exists query_letters_manuscript_id_idx on query_letters(manuscript_id);
