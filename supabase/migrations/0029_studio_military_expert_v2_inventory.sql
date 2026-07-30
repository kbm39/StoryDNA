-- Military Expert V2 scene inventory and selection (Phase 1 — additive only).

alter table public.editorial_workflows
  drop constraint if exists editorial_workflows_workflow_type_check;

alter table public.editorial_workflows
  add constraint editorial_workflows_workflow_type_check
  check (
    workflow_type in (
      'literary_agent_review',
      'military_expert_review',
      'military_expert_v2_inventory'
    )
  );

create table if not exists public.studio_military_expert_scene_inventories (
  id uuid primary key default gen_random_uuid(),
  inventory_id text not null unique,
  manuscript_id uuid not null references public.manuscripts(id) on delete cascade,
  manuscript_version_id uuid not null,
  workflow_id uuid references public.editorial_workflows(id) on delete set null,
  contract_version text not null,
  generated_at timestamptz not null,
  mode text not null check (mode in ('author', 'certification')),
  scene_count integer not null check (scene_count >= 0),
  major_scene_count integer not null check (major_scene_count >= 0),
  inventory_status text not null check (
    inventory_status in ('draft', 'ready_for_selection', 'superseded')
  ),
  content_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists studio_military_expert_scene_inventories_manuscript_idx
  on public.studio_military_expert_scene_inventories (manuscript_id, inventory_status);

create table if not exists public.studio_military_expert_scene_inventory_entries (
  id uuid primary key default gen_random_uuid(),
  inventory_id text not null references public.studio_military_expert_scene_inventories(inventory_id) on delete cascade,
  scene_id text not null,
  scene_index integer not null check (scene_index >= 1),
  locator jsonb not null,
  two_sentence_description text not null,
  scene_types text[] not null,
  action_categories text[] not null,
  participants text[] not null default '{}',
  priority_tier text not null check (priority_tier in ('major', 'moderate', 'minor')),
  discovery_confidence numeric(4, 3) not null check (
    discovery_confidence >= 0 and discovery_confidence <= 1
  ),
  discovery_source text not null,
  default_selected boolean not null,
  selection_warning_codes text[] not null default '{}',
  source_hash text not null,
  created_at timestamptz not null default now(),
  unique (inventory_id, scene_id)
);

create index if not exists studio_military_expert_scene_inventory_entries_inventory_idx
  on public.studio_military_expert_scene_inventory_entries (inventory_id, scene_index);

create table if not exists public.studio_military_expert_scene_selections (
  id uuid primary key default gen_random_uuid(),
  inventory_id text not null references public.studio_military_expert_scene_inventories(inventory_id) on delete cascade,
  scene_id text not null,
  is_selected boolean not null,
  selection_source text not null,
  selected_at timestamptz,
  warning_acknowledged boolean not null default false,
  estimated_input_tokens integer not null default 0,
  estimated_output_tokens integer not null default 0,
  estimated_cost_usd numeric(10, 4) not null default 0,
  estimated_runtime_seconds integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (inventory_id, scene_id),
  foreign key (inventory_id, scene_id)
    references public.studio_military_expert_scene_inventory_entries (inventory_id, scene_id)
    on delete cascade
);

create index if not exists studio_military_expert_scene_selections_inventory_idx
  on public.studio_military_expert_scene_selections (inventory_id, is_selected);

create table if not exists public.studio_military_expert_selection_snapshots (
  id uuid primary key default gen_random_uuid(),
  selection_snapshot_id text not null unique,
  inventory_id text not null references public.studio_military_expert_scene_inventories(inventory_id) on delete cascade,
  manuscript_id uuid not null references public.manuscripts(id) on delete cascade,
  manuscript_version_id uuid not null,
  mode text not null check (mode in ('author', 'certification')),
  confirmed_at timestamptz,
  confirmed_by text not null check (confirmed_by in ('author', 'system_certification')),
  immutable boolean not null default false,
  snapshot_payload jsonb not null,
  created_at timestamptz not null default now()
);

create unique index if not exists studio_military_expert_selection_snapshots_confirmed_unique
  on public.studio_military_expert_selection_snapshots (inventory_id)
  where immutable = true and confirmed_at is not null;

create index if not exists studio_military_expert_selection_snapshots_inventory_idx
  on public.studio_military_expert_selection_snapshots (inventory_id, immutable);
