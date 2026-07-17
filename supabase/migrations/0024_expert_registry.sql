-- Expert Registry · Milestone 2 Phase 1
-- Structured, versioned expert definitions for StoryDNA Expert Intelligence Platform.

-- ---------------------------------------------------------------------------
-- experts (identity / scope)
-- ---------------------------------------------------------------------------
create table if not exists public.experts (
  id            uuid primary key default gen_random_uuid(),
  expert_key    text not null,
  scope         text not null,
  manuscript_id uuid null references public.manuscripts(id) on delete cascade,
  series_id     uuid null references public.series(id) on delete cascade,
  display_name  text not null,
  title         text null,
  description   text null,
  department    text null,
  category      text not null,
  status        text not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint experts_scope_check check (
    scope in ('platform', 'project', 'dynamic', 'custom')
  ),
  constraint experts_status_check check (
    status in ('active', 'archived')
  ),
  constraint experts_project_scope_manuscript check (
    scope != 'project' or manuscript_id is not null
  )
);

create unique index if not exists experts_platform_key_unique
  on public.experts (expert_key)
  where scope = 'platform';

create unique index if not exists experts_project_key_manuscript_unique
  on public.experts (expert_key, manuscript_id)
  where scope = 'project' and manuscript_id is not null;

create index if not exists experts_category_idx on public.experts (category);
create index if not exists experts_scope_idx on public.experts (scope);

drop trigger if exists experts_set_updated_at on public.experts;
create trigger experts_set_updated_at
  before update on public.experts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- expert_versions (immutable definition snapshots)
-- ---------------------------------------------------------------------------
create table if not exists public.expert_versions (
  id                          uuid primary key default gen_random_uuid(),
  expert_id                   uuid not null references public.experts(id) on delete restrict,
  version                     text not null,
  lifecycle_status            text not null default 'draft',
  schema_version              text not null default 'expert_definition@v1',
  definition                  jsonb not null,
  definition_hash             text not null,
  mission                     text null,
  purpose                     text null,
  professional_standards_summary text null,
  supersedes_version_id       uuid null references public.expert_versions(id) on delete set null,
  change_summary              text null,
  created_by                  text null,
  published_at                timestamptz null,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  constraint expert_versions_lifecycle_check check (
    lifecycle_status in ('draft', 'active', 'deprecated', 'archived')
  ),
  constraint expert_versions_hash_format check (
    definition_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint expert_versions_unique_version unique (expert_id, version),
  constraint expert_versions_draft_unpublished check (
    lifecycle_status != 'draft' or published_at is null
  ),
  constraint expert_versions_active_published check (
    lifecycle_status not in ('active', 'deprecated') or published_at is not null
  )
);

create unique index if not exists expert_versions_one_active_per_expert
  on public.expert_versions (expert_id)
  where lifecycle_status = 'active';

create index if not exists expert_versions_expert_lifecycle_idx
  on public.expert_versions (expert_id, lifecycle_status, created_at desc);

drop trigger if exists expert_versions_set_updated_at on public.expert_versions;
create trigger expert_versions_set_updated_at
  before update on public.expert_versions
  for each row execute function set_updated_at();

-- Immutability: active, deprecated, archived versions cannot mutate core fields
create or replace function public.expert_versions_immutability_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.lifecycle_status in ('active', 'deprecated', 'archived') then
    if new.definition is distinct from old.definition
       or new.definition_hash is distinct from old.definition_hash
       or new.expert_id is distinct from old.expert_id
       or new.version is distinct from old.version
       or new.schema_version is distinct from old.schema_version
       or new.supersedes_version_id is distinct from old.supersedes_version_id
    then
      raise exception 'IMMUTABLE_EXPERT_VERSION';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists expert_versions_immutability on public.expert_versions;
create trigger expert_versions_immutability
  before update on public.expert_versions
  for each row execute function public.expert_versions_immutability_guard();

-- ---------------------------------------------------------------------------
-- expert_version_events (append-only audit)
-- ---------------------------------------------------------------------------
create table if not exists public.expert_version_events (
  id                uuid primary key default gen_random_uuid(),
  expert_version_id uuid not null references public.expert_versions(id) on delete cascade,
  event_type        text not null,
  details           jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  created_by        text null,

  constraint expert_version_events_type_check check (
    event_type in (
      'created', 'activated', 'deprecated', 'archived',
      'superseded', 'validation_failed', 'seed_updated'
    )
  )
);

create index if not exists expert_version_events_version_idx
  on public.expert_version_events (expert_version_id, created_at);

-- ---------------------------------------------------------------------------
-- Atomic activation RPC
-- ---------------------------------------------------------------------------
create or replace function public.activate_expert_version(
  p_version_id uuid,
  p_created_by text default 'system'
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_expert_id uuid;
  v_status text;
begin
  select expert_id, lifecycle_status
    into v_expert_id, v_status
  from public.expert_versions
  where id = p_version_id
  for update;

  if not found then
    raise exception 'VERSION_NOT_FOUND';
  end if;

  if v_status != 'draft' then
    raise exception 'NOT_DRAFT:%', v_status;
  end if;

  update public.expert_versions
  set lifecycle_status = 'deprecated',
      updated_at = now()
  where expert_id = v_expert_id
    and lifecycle_status = 'active';

  update public.expert_versions
  set lifecycle_status = 'active',
      published_at = coalesce(published_at, now()),
      updated_at = now()
  where id = p_version_id;

  insert into public.expert_version_events (expert_version_id, event_type, details, created_by)
  values (p_version_id, 'activated', jsonb_build_object('expert_id', v_expert_id), p_created_by);

  return p_version_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS — Phase 1: read-only anon; writes via service_role only
-- SECURITY LIMITATION: single-tenant app; replace with user-scoped policies later.
-- ---------------------------------------------------------------------------
alter table public.experts enable row level security;
alter table public.expert_versions enable row level security;
alter table public.expert_version_events enable row level security;

drop policy if exists experts_select_anon on public.experts;
create policy experts_select_anon on public.experts
  for select to anon, authenticated using (true);

drop policy if exists expert_versions_select_anon on public.expert_versions;
create policy expert_versions_select_anon on public.expert_versions
  for select to anon, authenticated using (true);

drop policy if exists expert_version_events_select_anon on public.expert_version_events;
create policy expert_version_events_select_anon on public.expert_version_events
  for select to anon, authenticated using (true);

revoke insert, update, delete on public.experts from anon, authenticated;
revoke insert, update, delete on public.expert_versions from anon, authenticated;
revoke insert, update, delete on public.expert_version_events from anon, authenticated;
