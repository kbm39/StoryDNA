-- Archivist segmented full-novel architecture · persistence design only.
-- Additive staging tables for workflow, plan, checkpoints, observations,
-- BookGraph metadata, coverage, candidate review, and cost ledger.
-- DO NOT APPLY in this phase. Accepted canon remains in 0025 and author-controlled.
-- Does not modify manuscripts, reviews, editorial_workflows, story_dna,
-- experts, expert_versions, or canon_facts accepted rows.

-- ---------------------------------------------------------------------------
-- archivist_segmented_workflows
-- ---------------------------------------------------------------------------
create table if not exists public.archivist_segmented_workflows (
  id                         uuid primary key default gen_random_uuid(),
  manuscript_id              uuid not null references public.manuscripts(id) on delete restrict,
  manuscript_version_id      uuid not null references public.manuscript_versions(id) on delete restrict,
  content_hash               text not null,
  archivist_version          text not null,
  archivist_definition_hash  text not null,
  status                     text not null default 'pending',
  authorized_to_run          boolean not null default false,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  constraint archivist_segmented_workflows_status_check check (
    status in ('pending', 'running', 'completed', 'failed', 'cancelled')
  ),
  constraint archivist_segmented_workflows_not_authorized check (
    authorized_to_run = false
  )
);

create index if not exists archivist_segmented_workflows_manuscript_idx
  on public.archivist_segmented_workflows (manuscript_id, manuscript_version_id);

-- ---------------------------------------------------------------------------
-- archivist_segment_plans
-- ---------------------------------------------------------------------------
create table if not exists public.archivist_segment_plans (
  id                    uuid primary key default gen_random_uuid(),
  workflow_id           uuid not null references public.archivist_segmented_workflows(id) on delete restrict,
  planner_version       text not null,
  plan_fingerprint      text not null,
  unit_count            int not null,
  segment_count         int not null,
  plan_json             jsonb not null,
  created_at            timestamptz not null default now(),
  constraint archivist_segment_plans_fingerprint_unique unique (workflow_id, plan_fingerprint)
);

create index if not exists archivist_segment_plans_workflow_idx
  on public.archivist_segment_plans (workflow_id);

-- ---------------------------------------------------------------------------
-- archivist_segment_checkpoints
-- ---------------------------------------------------------------------------
create table if not exists public.archivist_segment_checkpoints (
  id                         uuid primary key default gen_random_uuid(),
  workflow_id                uuid not null references public.archivist_segmented_workflows(id) on delete restrict,
  segment_id                 text not null,
  status                     text not null,
  manuscript_id              uuid not null,
  manuscript_version_id      uuid not null,
  content_hash               text not null,
  archivist_version          text not null,
  archivist_definition_hash  text not null,
  segment_contract_version   text not null,
  plan_fingerprint           text not null,
  segment_source_hash        text not null,
  start_offset               int not null,
  end_offset                 int not null,
  provider                   text not null,
  model                      text not null,
  error                      text,
  repair_used                boolean not null default false,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  constraint archivist_segment_checkpoints_status_check check (
    status in ('pending', 'running', 'validated', 'failed')
  ),
  constraint archivist_segment_checkpoints_unique unique (workflow_id, segment_id)
);

create index if not exists archivist_segment_checkpoints_workflow_idx
  on public.archivist_segment_checkpoints (workflow_id, status);

-- ---------------------------------------------------------------------------
-- archivist_segment_observations
-- ---------------------------------------------------------------------------
create table if not exists public.archivist_segment_observations (
  id                 uuid primary key default gen_random_uuid(),
  workflow_id        uuid not null references public.archivist_segmented_workflows(id) on delete restrict,
  checkpoint_id      uuid not null references public.archivist_segment_checkpoints(id) on delete restrict,
  segment_id         text not null,
  contract_version   text not null,
  observation_json   jsonb not null,
  created_at         timestamptz not null default now(),
  constraint archivist_segment_observations_no_accepted check (
    coalesce(observation_json->>'status', 'candidate') <> 'accepted'
  )
);

create index if not exists archivist_segment_observations_workflow_idx
  on public.archivist_segment_observations (workflow_id, segment_id);

-- ---------------------------------------------------------------------------
-- archivist_book_graphs
-- ---------------------------------------------------------------------------
create table if not exists public.archivist_book_graphs (
  id                 uuid primary key default gen_random_uuid(),
  workflow_id        uuid not null references public.archivist_segmented_workflows(id) on delete restrict,
  schema_version     text not null,
  graph_json         jsonb not null,
  created_at         timestamptz not null default now(),
  constraint archivist_book_graphs_one_per_workflow unique (workflow_id)
);

-- ---------------------------------------------------------------------------
-- archivist_coverage_reports
-- ---------------------------------------------------------------------------
create table if not exists public.archivist_coverage_reports (
  id                         uuid primary key default gen_random_uuid(),
  workflow_id                uuid not null references public.archivist_segmented_workflows(id) on delete restrict,
  unique_words_covered       int not null,
  overlap_words              int not null,
  coverage_percentage        numeric not null,
  complete                   boolean not null,
  report_json                jsonb not null,
  created_at                 timestamptz not null default now(),
  constraint archivist_coverage_reports_one_per_workflow unique (workflow_id)
);

-- ---------------------------------------------------------------------------
-- archivist_candidate_reviews
-- ---------------------------------------------------------------------------
create table if not exists public.archivist_candidate_reviews (
  id                 uuid primary key default gen_random_uuid(),
  workflow_id        uuid not null references public.archivist_segmented_workflows(id) on delete restrict,
  review_json        jsonb not null,
  candidate_canon    jsonb not null default '[]'::jsonb,
  created_at         timestamptz not null default now(),
  constraint archivist_candidate_reviews_one_per_workflow unique (workflow_id)
);

-- ---------------------------------------------------------------------------
-- archivist_segmented_cost_ledger
-- ---------------------------------------------------------------------------
create table if not exists public.archivist_segmented_cost_ledger (
  id                 uuid primary key default gen_random_uuid(),
  workflow_id        uuid not null references public.archivist_segmented_workflows(id) on delete restrict,
  role               text not null,
  provider           text not null,
  model              text not null,
  input_tokens       int,
  output_tokens      int,
  cost_usd           numeric,
  duration_ms        int not null default 0,
  status             text,
  created_at         timestamptz not null default now(),
  constraint archivist_segmented_cost_ledger_role_check check (
    role in (
      'segment_observation',
      'segment_repair',
      'global_reconciliation',
      'global_repair'
    )
  )
);

create index if not exists archivist_segmented_cost_ledger_workflow_idx
  on public.archivist_segmented_cost_ledger (workflow_id);

-- RLS: service-role writes only. No accepted-canon mutation path.
alter table public.archivist_segmented_workflows enable row level security;
alter table public.archivist_segment_plans enable row level security;
alter table public.archivist_segment_checkpoints enable row level security;
alter table public.archivist_segment_observations enable row level security;
alter table public.archivist_book_graphs enable row level security;
alter table public.archivist_coverage_reports enable row level security;
alter table public.archivist_candidate_reviews enable row level security;
alter table public.archivist_segmented_cost_ledger enable row level security;

revoke insert, update, delete on public.archivist_segmented_workflows from anon, authenticated;
revoke insert, update, delete on public.archivist_segment_plans from anon, authenticated;
revoke insert, update, delete on public.archivist_segment_checkpoints from anon, authenticated;
revoke insert, update, delete on public.archivist_segment_observations from anon, authenticated;
revoke insert, update, delete on public.archivist_book_graphs from anon, authenticated;
revoke insert, update, delete on public.archivist_coverage_reports from anon, authenticated;
revoke insert, update, delete on public.archivist_candidate_reviews from anon, authenticated;
revoke insert, update, delete on public.archivist_segmented_cost_ledger from anon, authenticated;

create policy archivist_segmented_workflows_select_anon on public.archivist_segmented_workflows
  for select to anon, authenticated using (false);
create policy archivist_segment_plans_select_anon on public.archivist_segment_plans
  for select to anon, authenticated using (false);
create policy archivist_segment_checkpoints_select_anon on public.archivist_segment_checkpoints
  for select to anon, authenticated using (false);
create policy archivist_segment_observations_select_anon on public.archivist_segment_observations
  for select to anon, authenticated using (false);
create policy archivist_book_graphs_select_anon on public.archivist_book_graphs
  for select to anon, authenticated using (false);
create policy archivist_coverage_reports_select_anon on public.archivist_coverage_reports
  for select to anon, authenticated using (false);
create policy archivist_candidate_reviews_select_anon on public.archivist_candidate_reviews
  for select to anon, authenticated using (false);
create policy archivist_segmented_cost_ledger_select_anon on public.archivist_segmented_cost_ledger
  for select to anon, authenticated using (false);
