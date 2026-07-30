-- Military Expert V2 Phase 2A — scene reviews and repair attempts (additive only).

alter table public.editorial_workflows
  drop constraint if exists editorial_workflows_workflow_type_check;

alter table public.editorial_workflows
  add constraint editorial_workflows_workflow_type_check
  check (
    workflow_type in (
      'literary_agent_review',
      'military_expert_review',
      'military_expert_v2_inventory',
      'military_expert_v2_scene_review'
    )
  );

create table if not exists public.studio_military_expert_scene_reviews (
  id uuid primary key default gen_random_uuid(),
  scene_review_id text not null unique,
  inventory_id text not null references public.studio_military_expert_scene_inventories(inventory_id) on delete cascade,
  selection_snapshot_id text not null references public.studio_military_expert_selection_snapshots(selection_snapshot_id) on delete cascade,
  scene_id text not null,
  manuscript_id uuid not null references public.manuscripts(id) on delete cascade,
  manuscript_version_id uuid not null,
  workflow_id uuid references public.editorial_workflows(id) on delete set null,
  review_status text not null check (
    review_status in (
      'queued',
      'running',
      'complete',
      'insufficient_evidence',
      'outside_expertise',
      'failed'
    )
  ),
  review_content jsonb,
  provider_metadata jsonb,
  cost_metadata jsonb,
  retry_count integer not null default 0 check (retry_count >= 0),
  repair_count integer not null default 0 check (repair_count >= 0),
  parsed_review_hash text,
  error_code text,
  safe_error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (selection_snapshot_id, scene_id),
  foreign key (inventory_id, scene_id)
    references public.studio_military_expert_scene_inventory_entries (inventory_id, scene_id)
    on delete cascade
);

create index if not exists studio_military_expert_scene_reviews_snapshot_idx
  on public.studio_military_expert_scene_reviews (selection_snapshot_id, review_status);

create index if not exists studio_military_expert_scene_reviews_workflow_idx
  on public.studio_military_expert_scene_reviews (workflow_id);

create table if not exists public.studio_military_expert_scene_review_repairs (
  id uuid primary key default gen_random_uuid(),
  scene_review_id text not null references public.studio_military_expert_scene_reviews(scene_review_id) on delete cascade,
  attempt_number integer not null check (attempt_number >= 1),
  repair_reason text not null,
  repair_cost_usd numeric(10, 6) not null default 0,
  repaired_fields jsonb not null default '[]',
  final_disposition text not null check (
    final_disposition in ('accepted', 'rejected', 'partial')
  ),
  created_at timestamptz not null default now(),
  unique (scene_review_id, attempt_number)
);

create index if not exists studio_military_expert_scene_review_repairs_review_idx
  on public.studio_military_expert_scene_review_repairs (scene_review_id);

create table if not exists public.studio_military_expert_scene_review_coverage (
  id uuid primary key default gen_random_uuid(),
  selection_snapshot_id text not null unique references public.studio_military_expert_selection_snapshots(selection_snapshot_id) on delete cascade,
  workflow_id uuid references public.editorial_workflows(id) on delete set null,
  selected_count integer not null check (selected_count >= 0),
  complete_count integer not null default 0 check (complete_count >= 0),
  insufficient_evidence_count integer not null default 0 check (insufficient_evidence_count >= 0),
  outside_expertise_count integer not null default 0 check (outside_expertise_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  coverage_percentage numeric(5, 2) not null default 0,
  validated_at timestamptz not null default now()
);
