-- Editorial Workflow Engine · Milestone 1
-- Generic durable workflow foundation for Publishing Workflow (Literary Agent first).
-- Supabase is the source of truth; Trigger.dev orchestrates execution.

-- ---------------------------------------------------------------------------
-- editorial_workflows
-- ---------------------------------------------------------------------------
create table if not exists public.editorial_workflows (
  id                          uuid primary key default gen_random_uuid(),

  -- Future multi-user; NULL in Milestone 1
  user_id                     uuid null,

  manuscript_id               uuid not null
                              references public.manuscripts(id) on delete cascade,
  manuscript_version_id       uuid not null,
  content_hash                text not null,

  workflow_type               text not null,
  workflow_definition_version text not null default 'literary_agent_review@v1',

  -- Generic Publishing Workflow metadata (nullable in M1; extensible for future types)
  department                  text null,
  owner_type                  text null,
  owner_label                 text null,
  purpose                     text null,
  participating_experts       jsonb null,
  next_best_action            text null,

  status                      text not null default 'queued',
  waiting_reason              text null,
  current_phase               text null,
  progress_summary            text null,

  trigger_run_id              text null,

  -- Unique per start attempt; new deliberate rerun gets a new key
  idempotency_key             text not null,

  authoritative_result_id     uuid null,
  authoritative_result_type   text null,
  result_summary              jsonb null,

  error_code                  text null,
  safe_error_message          text null,
  diagnostics_storage_key     text null,

  attempt_count               int not null default 0,
  max_attempts                int not null default 2,

  cancellation_requested_at   timestamptz null,
  cancelled_at                timestamptz null,
  cancelled_by                text null,

  input_snapshot              jsonb not null default '{}'::jsonb,

  queued_at                   timestamptz not null default now(),
  started_at                  timestamptz null,
  heartbeat_at                timestamptz null,
  paused_at                   timestamptz null,
  completed_at                timestamptz null,
  failed_at                   timestamptz null,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  constraint editorial_workflows_status_check check (
    status in ('queued','preparing','running','waiting','paused','completed','failed','cancelled')
  ),
  constraint editorial_workflows_type_check check (
    workflow_type in ('literary_agent_review')
  ),
  constraint editorial_workflows_version_fk foreign key (manuscript_version_id, manuscript_id)
    references public.manuscript_versions(id, manuscript_id) on delete restrict
);

create unique index if not exists editorial_workflows_idempotency_key
  on public.editorial_workflows (idempotency_key);

create unique index if not exists editorial_workflows_one_active_per_version
  on public.editorial_workflows (manuscript_id, manuscript_version_id, workflow_type)
  where status in ('queued','preparing','running','waiting','paused');

create index if not exists editorial_workflows_status_queued
  on public.editorial_workflows (status, queued_at)
  where status = 'queued';

create index if not exists editorial_workflows_heartbeat_stale
  on public.editorial_workflows (heartbeat_at)
  where status = 'running';

create index if not exists editorial_workflows_manuscript_recent
  on public.editorial_workflows (manuscript_id, created_at desc);

drop trigger if exists editorial_workflows_set_updated_at on public.editorial_workflows;
create trigger editorial_workflows_set_updated_at
  before update on public.editorial_workflows
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- editorial_workflow_events (append-only audit)
-- ---------------------------------------------------------------------------
create table if not exists public.editorial_workflow_events (
  id            uuid primary key default gen_random_uuid(),
  workflow_id   uuid not null
                references public.editorial_workflows(id) on delete cascade,
  event_type    text not null,
  phase         text null,
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists editorial_workflow_events_workflow
  on public.editorial_workflow_events (workflow_id, created_at);

-- ---------------------------------------------------------------------------
-- RLS — Milestone 1: read-only anon for Realtime; writes via service_role only
-- SECURITY LIMITATION: single-tenant app; replace with user-scoped policies later.
-- ---------------------------------------------------------------------------
alter table public.editorial_workflows enable row level security;
alter table public.editorial_workflow_events enable row level security;

drop policy if exists editorial_workflows_select_anon on public.editorial_workflows;
create policy editorial_workflows_select_anon on public.editorial_workflows
  for select to anon, authenticated using (true);

drop policy if exists editorial_workflow_events_select_anon on public.editorial_workflow_events;
create policy editorial_workflow_events_select_anon on public.editorial_workflow_events
  for select to anon, authenticated using (true);

revoke insert, update, delete on public.editorial_workflows from anon, authenticated;
revoke insert, update, delete on public.editorial_workflow_events from anon, authenticated;

-- Realtime (ignore if publication already includes table)
do $$
begin
  alter publication supabase_realtime add table public.editorial_workflows;
exception
  when duplicate_object then null;
end $$;
