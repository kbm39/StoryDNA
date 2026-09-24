-- DO NOT APPLY in this preparation phase.
-- Durable one-shot authorization row for a future explicit paid-pilot approval.
-- Not registered under supabase/migrations so linked push cannot apply it accidentally.
-- Accepted canon remains forbidden. Production remains out of scope.

create table if not exists public.archivist_pilot_authorizations (
  id                         uuid primary key default gen_random_uuid(),
  authorization_id           text not null unique,
  status                     text not null,
  manuscript_id              uuid not null,
  manuscript_version_id      uuid not null,
  content_hash               text not null,
  source_docx_sha256         text not null,
  analytical_word_count      int not null,
  plan_fingerprint           text not null,
  archivist_definition_hash  text not null,
  certified_pipeline_code_sha text not null,
  required_freeze_head       text not null,
  provider                   text not null,
  model                      text not null,
  staging_supabase_project_ref text not null,
  trigger_project_id         text not null,
  trigger_environment        text not null,
  hard_cost_ceiling_usd      numeric not null,
  max_active_workflows       int not null default 1,
  bound_workflow_id          uuid,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  constraint archivist_pilot_authorizations_status_check check (
    status in ('prepared', 'explicitly_authorized', 'consumed', 'revoked')
  ),
  constraint archivist_pilot_authorizations_one_workflow check (
    max_active_workflows = 1
  ),
  constraint archivist_pilot_authorizations_ceiling_check check (
    hard_cost_ceiling_usd <= 1
  ),
  constraint archivist_pilot_authorizations_not_production check (
    staging_supabase_project_ref <> 'tumcpxklduhiigxjwlrp'
  )
);

alter table public.archivist_pilot_authorizations enable row level security;
revoke insert, update, delete on public.archivist_pilot_authorizations from anon, authenticated;
create policy archivist_pilot_authorizations_select_anon on public.archivist_pilot_authorizations
  for select to anon, authenticated using (false);
