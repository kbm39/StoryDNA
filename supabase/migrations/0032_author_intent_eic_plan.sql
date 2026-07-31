-- EIC Phase 1A · Author Intent & EIC Editorial Plan
-- Additive migration. Not applied to Supabase during Phase 1A task.
-- Constitution §1 Author Intent + §10 EIC plan gate persistence.

-- ---------------------------------------------------------------------------
-- author_intent_records
-- ---------------------------------------------------------------------------
create table if not exists public.author_intent_records (
  id                      uuid primary key default gen_random_uuid(),
  manuscript_id           uuid not null references public.manuscripts(id) on delete cascade,
  manuscript_version_id   uuid not null,
  contract_version        text not null default 'storydna_author_intent@v1',
  intent_type             text not null,
  custom_objective_text   text null,
  author_success_definition text not null,
  requested_experts       text[] not null default '{}',
  declined_experts        text[] not null default '{}',
  priority_domains        text[] not null default '{}',
  budget_preference       text null,
  time_preference         text null,
  status                  text not null default 'draft',
  created_by              text not null,
  superseded_by_id        uuid null,
  supersedes_intent_id    uuid null,
  activated_at            timestamptz null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint author_intent_records_contract_version_check check (
    contract_version = 'storydna_author_intent@v1'
  ),
  constraint author_intent_records_status_check check (
    status in ('draft', 'active', 'superseded', 'cancelled')
  ),
  constraint author_intent_records_intent_type_check check (
    intent_type in (
      'general_manuscript_review',
      'query_preparation',
      'traditional_publishing',
      'self_publishing',
      'kindle_unlimited',
      'screenplay_adaptation',
      'television_adaptation',
      'comic_adaptation',
      'developmental_editing',
      'copy_editing',
      'military_realism',
      'medical_realism',
      'financial_realism',
      'continuity_review',
      'word_count_reduction',
      'series_consistency',
      'certification_benchmark',
      'custom'
    )
  ),
  constraint author_intent_records_custom_text check (
    intent_type != 'custom' or (custom_objective_text is not null and length(trim(custom_objective_text)) > 0)
  ),
  constraint author_intent_records_version_fk foreign key (manuscript_version_id, manuscript_id)
    references public.manuscript_versions(id, manuscript_id) on delete restrict
);

create index if not exists author_intent_records_manuscript_idx
  on public.author_intent_records (manuscript_id);

create index if not exists author_intent_records_version_idx
  on public.author_intent_records (manuscript_version_id);

create index if not exists author_intent_records_status_idx
  on public.author_intent_records (status);

create unique index if not exists author_intent_one_active_per_version
  on public.author_intent_records (manuscript_id, manuscript_version_id)
  where status = 'active';

alter table public.author_intent_records
  drop constraint if exists author_intent_records_supersedes_fk;

alter table public.author_intent_records
  add constraint author_intent_records_supersedes_fk
  foreign key (supersedes_intent_id) references public.author_intent_records(id) on delete set null;

alter table public.author_intent_records
  drop constraint if exists author_intent_records_superseded_by_fk;

alter table public.author_intent_records
  add constraint author_intent_records_superseded_by_fk
  foreign key (superseded_by_id) references public.author_intent_records(id) on delete set null;

drop trigger if exists author_intent_records_set_updated_at on public.author_intent_records;
create trigger author_intent_records_set_updated_at
  before update on public.author_intent_records
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- eic_editorial_plans
-- ---------------------------------------------------------------------------
create table if not exists public.eic_editorial_plans (
  id                      uuid primary key default gen_random_uuid(),
  manuscript_id           uuid not null references public.manuscripts(id) on delete cascade,
  manuscript_version_id   uuid not null,
  author_intent_id        uuid not null references public.author_intent_records(id) on delete restrict,
  contract_version        text not null default 'storydna_eic_editorial_plan@v1',
  plan                    jsonb not null,
  status                  text not null default 'draft',
  created_by              text not null,
  superseded_by_id        uuid null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint eic_editorial_plans_contract_version_check check (
    contract_version = 'storydna_eic_editorial_plan@v1'
  ),
  constraint eic_editorial_plans_status_check check (
    status in (
      'blocked_missing_intent',
      'draft',
      'awaiting_author_confirmation',
      'confirmed',
      'superseded',
      'cancelled'
    )
  ),
  constraint eic_editorial_plans_version_fk foreign key (manuscript_version_id, manuscript_id)
    references public.manuscript_versions(id, manuscript_id) on delete restrict
);

create index if not exists eic_editorial_plans_manuscript_idx
  on public.eic_editorial_plans (manuscript_id);

create index if not exists eic_editorial_plans_intent_idx
  on public.eic_editorial_plans (author_intent_id);

create index if not exists eic_editorial_plans_status_idx
  on public.eic_editorial_plans (status);

drop trigger if exists eic_editorial_plans_set_updated_at on public.eic_editorial_plans;
create trigger eic_editorial_plans_set_updated_at
  before update on public.eic_editorial_plans
  for each row execute function set_updated_at();
