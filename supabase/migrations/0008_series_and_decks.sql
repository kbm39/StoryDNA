-- Series: group books (manuscripts) into a cohesive franchise, in order.
create table if not exists series (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  logline text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table manuscripts add column if not exists series_id uuid references series(id) on delete set null;
alter table manuscripts add column if not exists series_order int;
create index if not exists manuscripts_series_idx on manuscripts(series_id);

-- Pitch decks: slide-based pitch for a single manuscript OR a whole series.
create table if not exists pitch_decks (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid references manuscripts(id) on delete cascade,
  series_id uuid references series(id) on delete cascade,
  scope text not null check (scope in ('manuscript','series')),
  provider text not null check (provider in ('openai','anthropic')),
  model text,
  title text,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists pitch_decks_manuscript_idx on pitch_decks(manuscript_id);
create index if not exists pitch_decks_series_idx on pitch_decks(series_id);

-- Let treatments also belong to a series (cohesive, cross-book treatment).
alter table treatments alter column manuscript_id drop not null;
alter table treatments add column if not exists series_id uuid references series(id) on delete cascade;
create index if not exists treatments_series_idx on treatments(series_id);
