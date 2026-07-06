-- Generated screen treatments (pitch documents) built from a manuscript.
create table if not exists treatments (
  id            uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references manuscripts(id) on delete cascade,
  provider      text not null check (provider in ('openai', 'anthropic')),
  model         text,
  format        text not null,
  content       text not null,
  created_at    timestamptz not null default now()
);
create index if not exists treatments_manuscript_id_idx on treatments(manuscript_id);
