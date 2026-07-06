-- Generic AI-generated documents grounded in a manuscript (synopsis, opening-pages
-- critique, line/copy-edit pass, continuity & character bible, marketing copy).
create table if not exists manuscript_documents (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references manuscripts(id) on delete cascade,
  doc_type text not null check (doc_type in ('synopsis','opening_critique','line_edit','continuity','marketing')),
  provider text not null check (provider in ('openai','anthropic')),
  model text,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists manuscript_documents_idx
  on manuscript_documents(manuscript_id, doc_type);

-- Submission tracker: which agents a manuscript has been queried to, and status.
create table if not exists agent_submissions (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references manuscripts(id) on delete cascade,
  agent_id text,
  agent_name text,
  agency text,
  status text not null default 'querying'
    check (status in ('querying','no_response','rejected','partial_request','full_request','offer','withdrawn')),
  queried_on date,
  responded_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists agent_submissions_manuscript_idx
  on agent_submissions(manuscript_id);
