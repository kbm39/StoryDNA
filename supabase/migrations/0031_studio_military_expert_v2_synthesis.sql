-- Military Expert V2 Phase 2B — synthesis documents and repair attempts (additive only).

alter table public.editorial_workflows
  drop constraint if exists editorial_workflows_workflow_type_check;

alter table public.editorial_workflows
  add constraint editorial_workflows_workflow_type_check
  check (
    workflow_type in (
      'literary_agent_review',
      'military_expert_review',
      'military_expert_v2_inventory',
      'military_expert_v2_scene_review',
      'military_expert_v2_synthesis'
    )
  );

create table if not exists public.studio_military_expert_v2_syntheses (
  id uuid primary key default gen_random_uuid(),
  synthesis_id text not null unique,
  inventory_id text not null references public.studio_military_expert_scene_inventories(inventory_id) on delete cascade,
  selection_snapshot_id text not null references public.studio_military_expert_selection_snapshots(selection_snapshot_id) on delete cascade,
  manuscript_id uuid not null references public.manuscripts(id) on delete cascade,
  manuscript_version_id uuid not null,
  workflow_id uuid references public.editorial_workflows(id) on delete set null,
  phase2a_workflow_id uuid references public.editorial_workflows(id) on delete set null,
  status text not null check (
    status in ('queued', 'running', 'complete', 'failed')
  ),
  synthesis_content jsonb,
  provider_metadata jsonb,
  cost_metadata jsonb,
  repair_count integer not null default 0 check (repair_count >= 0),
  parsed_hash text,
  error_code text,
  safe_error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists studio_military_expert_v2_syntheses_snapshot_idx
  on public.studio_military_expert_v2_syntheses (selection_snapshot_id, status);

create index if not exists studio_military_expert_v2_syntheses_workflow_idx
  on public.studio_military_expert_v2_syntheses (workflow_id);

create table if not exists public.studio_military_expert_v2_synthesis_repairs (
  id uuid primary key default gen_random_uuid(),
  synthesis_id text not null references public.studio_military_expert_v2_syntheses(synthesis_id) on delete cascade,
  attempt_number integer not null check (attempt_number >= 1),
  repair_reason text not null,
  repair_cost_usd numeric(10, 6) not null default 0,
  repaired_fields jsonb not null default '[]',
  final_disposition text not null check (
    final_disposition in ('accepted', 'rejected', 'partial')
  ),
  created_at timestamptz not null default now(),
  unique (synthesis_id, attempt_number)
);

create index if not exists studio_military_expert_v2_synthesis_repairs_synthesis_idx
  on public.studio_military_expert_v2_synthesis_repairs (synthesis_id);
