-- StoryDNA (V2): a persistent story-intelligence layer, separate from the
-- editorial reports. One analysis per manuscript (the extracted "DNA" lives in
-- a jsonb blob so the shape can evolve), plus a durable interview memory that
-- captures the author's answers about their characters over time.

create table if not exists story_dna (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references manuscripts(id) on delete cascade,
  provider text check (provider in ('openai','anthropic')),
  model text,
  status text not null default 'ready' check (status in ('ready','error')),
  chapters_count int,
  protagonist_name text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (manuscript_id)
);

create index if not exists story_dna_manuscript_idx on story_dna(manuscript_id);

-- Persistent StoryDNA memory: answers to character-interview questions.
create table if not exists story_dna_interview (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references manuscripts(id) on delete cascade,
  character_name text,
  question_key text not null,
  question text not null,
  answer text not null check (answer in ('yes','no','not_sure')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (manuscript_id, question_key)
);

create index if not exists story_dna_interview_manuscript_idx
  on story_dna_interview(manuscript_id);
