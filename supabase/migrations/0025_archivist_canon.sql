-- Archivist / Continuity Expert · Phase 1
-- Structured canon persistence. Observations are not Series Bible.
-- Extraction cannot create accepted canon. Author action is required.
--
-- Authority rank (higher wins). Encoded as text; numeric rank lives in
-- lib/canon/authority.ts — do not use unexplained integers in SQL.
--   6  author_approved_exception
--   5  series_bible_accepted
--   4  prior_volume_canon
--   3  current_observation
--   2  inferred
--   1  uncertain_observation
--
-- Does not modify manuscripts, reviews, workflows, story_dna, or expert_versions.
-- Depends on: series (0008), manuscripts, manuscript_versions (0019).
-- Independent of Expert Registry identity tables (0024).

-- ---------------------------------------------------------------------------
-- canon_entities
-- ---------------------------------------------------------------------------
create table if not exists public.canon_entities (
  id                         uuid primary key default gen_random_uuid(),
  series_id                  uuid null references public.series(id) on delete restrict,
  standalone_manuscript_id   uuid null references public.manuscripts(id) on delete restrict,
  entity_type                text not null,
  canonical_name             text not null,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),

  constraint canon_entities_type_check check (
    entity_type in (
      'person', 'place', 'object', 'vehicle', 'weapon',
      'event', 'organization', 'other'
    )
  ),
  constraint canon_entities_scope_xor check (
    (series_id is not null and standalone_manuscript_id is null)
    or (series_id is null and standalone_manuscript_id is not null)
  )
);

create index if not exists canon_entities_series_idx
  on public.canon_entities (series_id)
  where series_id is not null;

create index if not exists canon_entities_standalone_idx
  on public.canon_entities (standalone_manuscript_id)
  where standalone_manuscript_id is not null;

create index if not exists canon_entities_type_idx
  on public.canon_entities (entity_type);

drop trigger if exists canon_entities_set_updated_at on public.canon_entities;
create trigger canon_entities_set_updated_at
  before update on public.canon_entities
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- canon_entity_aliases
-- Uniqueness is per entity only: (entity_id, alias_normalized).
-- Different entities in the same series MAY share an alias ("John").
-- Denormalized series/standalone columns exist for lookup, not exclusivity.
-- Resolution of a shared alias is ambiguous; do not merge entities.
-- ---------------------------------------------------------------------------
create table if not exists public.canon_entity_aliases (
  id                         uuid primary key default gen_random_uuid(),
  entity_id                  uuid not null references public.canon_entities(id) on delete cascade,
  series_id                  uuid null,
  standalone_manuscript_id   uuid null,
  alias                      text not null,
  alias_normalized           text not null,
  created_at                 timestamptz not null default now(),

  constraint canon_entity_aliases_normalized_check check (
    alias_normalized = lower(btrim(alias))
  ),
  constraint canon_entity_aliases_unique_per_entity unique (entity_id, alias_normalized)
);

create index if not exists canon_entity_aliases_series_alias_idx
  on public.canon_entity_aliases (series_id, alias_normalized)
  where series_id is not null;

create index if not exists canon_entity_aliases_standalone_alias_idx
  on public.canon_entity_aliases (standalone_manuscript_id, alias_normalized)
  where standalone_manuscript_id is not null;

create or replace function public.canon_entity_aliases_sync_scope()
returns trigger
language plpgsql
as $$
declare
  v_series uuid;
  v_standalone uuid;
begin
  select series_id, standalone_manuscript_id
    into v_series, v_standalone
  from public.canon_entities
  where id = new.entity_id;

  if not found then
    raise exception 'CANON_ENTITY_NOT_FOUND';
  end if;

  new.series_id := v_series;
  new.standalone_manuscript_id := v_standalone;
  new.alias_normalized := lower(btrim(new.alias));
  return new;
end;
$$;

drop trigger if exists canon_entity_aliases_sync_scope on public.canon_entity_aliases;
create trigger canon_entity_aliases_sync_scope
  before insert or update on public.canon_entity_aliases
  for each row execute function public.canon_entity_aliases_sync_scope();

-- ---------------------------------------------------------------------------
-- canon_facts
-- ---------------------------------------------------------------------------
create table if not exists public.canon_facts (
  id                      uuid primary key default gen_random_uuid(),
  series_id               uuid null references public.series(id) on delete restrict,
  entity_id               uuid not null references public.canon_entities(id) on delete restrict,
  fact_type               text not null,
  fact_value              jsonb not null,
  temporal_scope          jsonb not null default '{}'::jsonb,
  source_manuscript_id    uuid not null references public.manuscripts(id) on delete restrict,
  source_version_id       uuid not null,
  source_content_hash     text not null,
  locator                 text null,
  confidence              text not null,
  authority               text not null,
  status                  text not null default 'candidate',
  superseded_by_fact_id   uuid null references public.canon_facts(id) on delete restrict,
  created_by              text not null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint canon_facts_type_check check (
    fact_type in (
      'age', 'appearance', 'injury', 'alive_status', 'rank_title',
      'relationship', 'location', 'possession', 'knowledge_state',
      'chronology', 'travel', 'presence', 'other'
    )
  ),
  constraint canon_facts_confidence_check check (
    confidence in ('high', 'medium', 'low', 'insufficient')
  ),
  constraint canon_facts_authority_check check (
    authority in (
      'author_approved_exception',
      'series_bible_accepted',
      'prior_volume_canon',
      'current_observation',
      'inferred',
      'uncertain_observation'
    )
  ),
  constraint canon_facts_status_check check (
    status in ('candidate', 'accepted', 'superseded', 'rejected')
  ),
  constraint canon_facts_created_by_check check (
    created_by in ('extraction', 'author', 'bible_import', 'inferred')
  ),
  constraint canon_facts_hash_format check (
    source_content_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint canon_facts_version_belongs_to_manuscript
    foreign key (source_version_id, source_manuscript_id)
    references public.manuscript_versions (id, manuscript_id)
    on delete restrict,
  constraint canon_facts_supersede_not_self check (
    superseded_by_fact_id is distinct from id
  ),
  constraint canon_facts_inferred_not_accepted check (
    status != 'accepted'
    or authority not in ('inferred', 'uncertain_observation')
  )
);

create index if not exists canon_facts_series_idx
  on public.canon_facts (series_id)
  where series_id is not null;

create index if not exists canon_facts_entity_idx
  on public.canon_facts (entity_id);

create index if not exists canon_facts_type_status_idx
  on public.canon_facts (fact_type, status);

create index if not exists canon_facts_authority_idx
  on public.canon_facts (authority);

create index if not exists canon_facts_source_manuscript_idx
  on public.canon_facts (source_manuscript_id, source_version_id);

create index if not exists canon_facts_superseded_by_idx
  on public.canon_facts (superseded_by_fact_id)
  where superseded_by_fact_id is not null;

-- Time-varying facts (age, rank, appearance, alive_status) may have multiple
-- accepted rows in the same book when temporal scopes differ (birthday,
-- mid-volume promotion, death, disguise). Do NOT unique on book_order.
-- Semantic overlap is enforced in lib/canon/temporal.ts, not SQL.

drop trigger if exists canon_facts_set_updated_at on public.canon_facts;
create trigger canon_facts_set_updated_at
  before update on public.canon_facts
  for each row execute function set_updated_at();

create or replace function public.canon_facts_immutability_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.created_by = 'extraction' and new.status = 'accepted' then
      raise exception 'EXTRACTION_CANNOT_ACCEPT_CANON';
    end if;
    if new.status = 'accepted' and new.created_by not in ('author', 'bible_import') then
      raise exception 'ACCEPTED_CANON_REQUIRES_AUTHOR';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.status = 'accepted' then
      if new.fact_value is distinct from old.fact_value
         or new.fact_type is distinct from old.fact_type
         or new.entity_id is distinct from old.entity_id
         or new.authority is distinct from old.authority
         or new.source_manuscript_id is distinct from old.source_manuscript_id
         or new.source_version_id is distinct from old.source_version_id
         or new.source_content_hash is distinct from old.source_content_hash
      then
        raise exception 'IMMUTABLE_ACCEPTED_CANON';
      end if;
      if new.status not in ('accepted', 'superseded') then
        raise exception 'ACCEPTED_CANON_STATUS_LOCKED';
      end if;
    end if;

    if old.status = 'candidate' and new.status = 'accepted' then
      if new.authority in ('inferred', 'uncertain_observation') then
        raise exception 'INFERRED_CANNOT_BECOME_CANON';
      end if;
    end if;

    if old.status in ('superseded', 'rejected') then
      if new.status is distinct from old.status
         or new.fact_value is distinct from old.fact_value
         or new.superseded_by_fact_id is distinct from old.superseded_by_fact_id
      then
        raise exception 'TERMINAL_CANON_FACT_LOCKED';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists canon_facts_immutability on public.canon_facts;
create trigger canon_facts_immutability
  before insert or update on public.canon_facts
  for each row execute function public.canon_facts_immutability_guard();

-- ---------------------------------------------------------------------------
-- canon_fact_transitions (promotion, supersession, retcon, rejection)
-- Historical rows are never deleted when facts are superseded.
-- ---------------------------------------------------------------------------
create table if not exists public.canon_fact_transitions (
  id                  uuid primary key default gen_random_uuid(),
  from_fact_id        uuid not null references public.canon_facts(id) on delete restrict,
  to_fact_id          uuid null references public.canon_facts(id) on delete restrict,
  kind                text not null,
  reason              text null,
  created_by          text not null,
  created_at          timestamptz not null default now(),

  constraint canon_fact_transitions_kind_check check (
    kind in ('promotion', 'supersession', 'retcon', 'rejection')
  ),
  constraint canon_fact_transitions_created_by_check check (
    created_by in ('author', 'bible_import', 'system')
  ),
  constraint canon_fact_transitions_retcon_has_replacement check (
    kind not in ('supersession', 'retcon') or to_fact_id is not null
  )
);

create index if not exists canon_fact_transitions_from_idx
  on public.canon_fact_transitions (from_fact_id, created_at);

create index if not exists canon_fact_transitions_to_idx
  on public.canon_fact_transitions (to_fact_id)
  where to_fact_id is not null;

-- ---------------------------------------------------------------------------
-- canon_conflicts (never stored as facts)
-- ---------------------------------------------------------------------------
create table if not exists public.canon_conflicts (
  id                           uuid primary key default gen_random_uuid(),
  series_id                    uuid null references public.series(id) on delete restrict,
  manuscript_id                uuid not null references public.manuscripts(id) on delete restrict,
  classification               text not null,
  severity                     text not null,
  confidence                   text not null,
  current_observation_fact_id  uuid not null references public.canon_facts(id) on delete restrict,
  conflicting_canon_fact_id    uuid null references public.canon_facts(id) on delete restrict,
  explanation                  text not null,
  suggested_resolution         text null,
  author_action                text not null default 'pending',
  author_comment               text null,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now(),

  constraint canon_conflicts_classification_check check (
    classification in (
      'confirmed_contradiction',
      'possible_continuity_conflict',
      'author_verification_needed'
    )
  ),
  constraint canon_conflicts_severity_check check (
    severity in ('critical', 'major', 'moderate', 'minor', 'informational')
  ),
  constraint canon_conflicts_confidence_check check (
    confidence in ('high', 'medium', 'low', 'insufficient')
  ),
  constraint canon_conflicts_author_action_check check (
    author_action in (
      'pending', 'accept_correction', 'mark_intentional',
      'update_canon', 'dismiss', 'comment'
    )
  ),
  constraint canon_conflicts_not_same_fact check (
    conflicting_canon_fact_id is distinct from current_observation_fact_id
  )
);

create index if not exists canon_conflicts_manuscript_idx
  on public.canon_conflicts (manuscript_id);

create index if not exists canon_conflicts_series_idx
  on public.canon_conflicts (series_id)
  where series_id is not null;

create index if not exists canon_conflicts_classification_idx
  on public.canon_conflicts (classification, author_action);

create index if not exists canon_conflicts_current_fact_idx
  on public.canon_conflicts (current_observation_fact_id);

drop trigger if exists canon_conflicts_set_updated_at on public.canon_conflicts;
create trigger canon_conflicts_set_updated_at
  before update on public.canon_conflicts
  for each row execute function set_updated_at();

create table if not exists public.canon_conflict_events (
  id              uuid primary key default gen_random_uuid(),
  conflict_id     uuid not null references public.canon_conflicts(id) on delete restrict,
  author_action   text not null,
  comment         text null,
  created_by      text not null default 'author',
  created_at      timestamptz not null default now(),

  constraint canon_conflict_events_action_check check (
    author_action in (
      'pending', 'accept_correction', 'mark_intentional',
      'update_canon', 'dismiss', 'comment'
    )
  )
);

create index if not exists canon_conflict_events_conflict_idx
  on public.canon_conflict_events (conflict_id, created_at);

-- ---------------------------------------------------------------------------
-- canon_evidence (facts and conflicts; both sides of a contradiction)
-- ---------------------------------------------------------------------------
create table if not exists public.canon_evidence (
  id                      uuid primary key default gen_random_uuid(),
  fact_id                 uuid null references public.canon_facts(id) on delete restrict,
  conflict_id             uuid null references public.canon_conflicts(id) on delete restrict,
  evidence_role           text not null,
  manuscript_id           uuid not null references public.manuscripts(id) on delete restrict,
  manuscript_version_id   uuid not null,
  content_hash            text not null,
  locator                 text null,
  excerpt                 text null,
  normalized_excerpt      text null,
  verification_status     text not null default 'unverified',
  created_at              timestamptz not null default now(),

  constraint canon_evidence_target_check check (
    (fact_id is not null and conflict_id is null)
    or (fact_id is null and conflict_id is not null)
    or (fact_id is not null and conflict_id is not null)
  ),
  constraint canon_evidence_role_check check (
    evidence_role in (
      'current_observation', 'conflicting_canon', 'supporting', 'contrary'
    )
  ),
  constraint canon_evidence_verification_check check (
    verification_status in ('unverified', 'located', 'not_found', 'skipped')
  ),
  constraint canon_evidence_hash_format check (
    content_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint canon_evidence_version_belongs_to_manuscript
    foreign key (manuscript_version_id, manuscript_id)
    references public.manuscript_versions (id, manuscript_id)
    on delete restrict
);

create index if not exists canon_evidence_fact_idx
  on public.canon_evidence (fact_id)
  where fact_id is not null;

create index if not exists canon_evidence_conflict_idx
  on public.canon_evidence (conflict_id)
  where conflict_id is not null;

create index if not exists canon_evidence_version_idx
  on public.canon_evidence (manuscript_id, manuscript_version_id);

-- ---------------------------------------------------------------------------
-- series_bible_revisions
-- First-book extraction does NOT insert revision 1. Author promotion required.
-- ---------------------------------------------------------------------------
create table if not exists public.series_bible_revisions (
  id                       uuid primary key default gen_random_uuid(),
  series_id                uuid not null references public.series(id) on delete restrict,
  revision_number          int not null check (revision_number > 0),
  status                   text not null default 'draft',
  supersedes_revision_id   uuid null references public.series_bible_revisions(id) on delete restrict,
  notes                    text null,
  created_by               text not null,
  accepted_at              timestamptz null,
  accepted_by              text null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint series_bible_revisions_status_check check (
    status in ('draft', 'accepted', 'superseded')
  ),
  constraint series_bible_revisions_unique_number unique (series_id, revision_number),
  constraint series_bible_revisions_draft_unaccepted check (
    status != 'draft' or accepted_at is null
  ),
  constraint series_bible_revisions_accepted_has_stamp check (
    status != 'accepted' or (accepted_at is not null and accepted_by is not null)
  ),
  constraint series_bible_revisions_created_by_check check (
    created_by in ('author', 'bible_import', 'system')
  )
);

create unique index if not exists series_bible_revisions_one_accepted_per_series
  on public.series_bible_revisions (series_id)
  where status = 'accepted';

create index if not exists series_bible_revisions_series_idx
  on public.series_bible_revisions (series_id, revision_number desc);

drop trigger if exists series_bible_revisions_set_updated_at on public.series_bible_revisions;
create trigger series_bible_revisions_set_updated_at
  before update on public.series_bible_revisions
  for each row execute function set_updated_at();

create table if not exists public.series_bible_revision_facts (
  revision_id  uuid not null references public.series_bible_revisions(id) on delete restrict,
  fact_id      uuid not null references public.canon_facts(id) on delete restrict,
  created_at   timestamptz not null default now(),
  primary key (revision_id, fact_id)
);

create index if not exists series_bible_revision_facts_fact_idx
  on public.series_bible_revision_facts (fact_id);

-- ---------------------------------------------------------------------------
-- RLS — read for anon/authenticated; writes via service_role only
-- SECURITY LIMITATION: single-tenant app; replace with user-scoped policies later.
-- ---------------------------------------------------------------------------
alter table public.canon_entities enable row level security;
alter table public.canon_entity_aliases enable row level security;
alter table public.canon_facts enable row level security;
alter table public.canon_fact_transitions enable row level security;
alter table public.canon_conflicts enable row level security;
alter table public.canon_conflict_events enable row level security;
alter table public.canon_evidence enable row level security;
alter table public.series_bible_revisions enable row level security;
alter table public.series_bible_revision_facts enable row level security;

drop policy if exists canon_entities_select_anon on public.canon_entities;
create policy canon_entities_select_anon on public.canon_entities
  for select to anon, authenticated using (true);

drop policy if exists canon_entity_aliases_select_anon on public.canon_entity_aliases;
create policy canon_entity_aliases_select_anon on public.canon_entity_aliases
  for select to anon, authenticated using (true);

drop policy if exists canon_facts_select_anon on public.canon_facts;
create policy canon_facts_select_anon on public.canon_facts
  for select to anon, authenticated using (true);

drop policy if exists canon_fact_transitions_select_anon on public.canon_fact_transitions;
create policy canon_fact_transitions_select_anon on public.canon_fact_transitions
  for select to anon, authenticated using (true);

drop policy if exists canon_conflicts_select_anon on public.canon_conflicts;
create policy canon_conflicts_select_anon on public.canon_conflicts
  for select to anon, authenticated using (true);

drop policy if exists canon_conflict_events_select_anon on public.canon_conflict_events;
create policy canon_conflict_events_select_anon on public.canon_conflict_events
  for select to anon, authenticated using (true);

drop policy if exists canon_evidence_select_anon on public.canon_evidence;
create policy canon_evidence_select_anon on public.canon_evidence
  for select to anon, authenticated using (true);

drop policy if exists series_bible_revisions_select_anon on public.series_bible_revisions;
create policy series_bible_revisions_select_anon on public.series_bible_revisions
  for select to anon, authenticated using (true);

drop policy if exists series_bible_revision_facts_select_anon on public.series_bible_revision_facts;
create policy series_bible_revision_facts_select_anon on public.series_bible_revision_facts
  for select to anon, authenticated using (true);

revoke insert, update, delete on public.canon_entities from anon, authenticated;
revoke insert, update, delete on public.canon_entity_aliases from anon, authenticated;
revoke insert, update, delete on public.canon_facts from anon, authenticated;
revoke insert, update, delete on public.canon_fact_transitions from anon, authenticated;
revoke insert, update, delete on public.canon_conflicts from anon, authenticated;
revoke insert, update, delete on public.canon_conflict_events from anon, authenticated;
revoke insert, update, delete on public.canon_evidence from anon, authenticated;
revoke insert, update, delete on public.series_bible_revisions from anon, authenticated;
revoke insert, update, delete on public.series_bible_revision_facts from anon, authenticated;
