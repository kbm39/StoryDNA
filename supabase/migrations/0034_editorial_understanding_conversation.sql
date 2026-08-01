-- EIC Phase 1B-ab · Editorial Understanding + Conversational Intelligence
-- Additive migration. Does not alter Phase 1A or 1B-a tables.

-- ---------------------------------------------------------------------------
-- editorial_understandings
-- ---------------------------------------------------------------------------
create table if not exists public.editorial_understandings (
  id                          uuid primary key default gen_random_uuid(),
  book_id                     uuid not null references public.manuscripts(id) on delete cascade,
  manuscript_id               uuid not null references public.manuscripts(id) on delete cascade,
  manuscript_version_id       uuid not null,
  contract_version            text not null default 'storydna_editorial_understanding@v1',
  interview_type              text not null default 'eic_author_intake',
  conducted_by                text not null default 'editor_in_chief',
  primary_vision              text null,
  target_reader               text null,
  desired_reader_experience   text null,
  market_position             text null,
  creative_motivation         text null,
  success_definition          text null,
  comparison_titles           text null,
  open_questions              jsonb not null default '[]'::jsonb,
  confidence                  jsonb not null default '{}'::jsonb,
  resolved_clarifications     jsonb not null default '[]'::jsonb,
  conversation_history        jsonb not null default '[]'::jsonb,
  stage_turns                 jsonb not null default '[]'::jsonb,
  understanding_summary       text null,
  version                     integer not null default 1,
  status                      text not null default 'draft',
  is_manuscript_evidence      boolean not null default false,
  is_author_intent            boolean not null default false,
  is_canon                    boolean not null default false,
  created_by                  text not null,
  confirmed_at                timestamptz null,
  confirmed_by                text null,
  supersedes_understanding_id uuid null,
  superseded_at               timestamptz null,
  provider_model              text null,
  provider_cost_usd           numeric(12, 6) null default 0,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  constraint editorial_understandings_contract_version_check check (
    contract_version = 'storydna_editorial_understanding@v1'
  ),
  constraint editorial_understandings_status_check check (
    status in (
      'draft',
      'awaiting_author_confirmation',
      'confirmed',
      'correction_requested',
      'superseded',
      'cancelled'
    )
  ),
  constraint editorial_understandings_book_manuscript_match check (
    book_id = manuscript_id
  ),
  constraint editorial_understandings_version_fk foreign key (manuscript_version_id, manuscript_id)
    references public.manuscript_versions(id, manuscript_id) on delete restrict,
  constraint editorial_understandings_evidence_flag_check check (is_manuscript_evidence = false),
  constraint editorial_understandings_intent_flag_check check (is_author_intent = false),
  constraint editorial_understandings_canon_flag_check check (is_canon = false)
);

create index if not exists editorial_understandings_manuscript_idx
  on public.editorial_understandings (manuscript_id);

create index if not exists editorial_understandings_version_idx
  on public.editorial_understandings (manuscript_version_id);

create index if not exists editorial_understandings_status_idx
  on public.editorial_understandings (status);

create unique index if not exists editorial_understandings_one_draft_per_author_version
  on public.editorial_understandings (manuscript_id, manuscript_version_id, created_by)
  where status = 'draft';

create unique index if not exists editorial_understandings_one_confirmed_per_version
  on public.editorial_understandings (manuscript_id, manuscript_version_id)
  where status = 'confirmed';

alter table public.editorial_understandings
  drop constraint if exists editorial_understandings_supersedes_fk;

alter table public.editorial_understandings
  add constraint editorial_understandings_supersedes_fk
  foreign key (supersedes_understanding_id) references public.editorial_understandings(id) on delete set null;

drop trigger if exists editorial_understandings_set_updated_at on public.editorial_understandings;
create trigger editorial_understandings_set_updated_at
  before update on public.editorial_understandings
  for each row execute function set_updated_at();

-- Prevent mutation of confirmed understanding content
create or replace function public.editorial_understandings_immutable_confirmed()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.status = 'confirmed' and new.status = 'confirmed' then
    if new.primary_vision is distinct from old.primary_vision
      or new.target_reader is distinct from old.target_reader
      or new.desired_reader_experience is distinct from old.desired_reader_experience
      or new.market_position is distinct from old.market_position
      or new.creative_motivation is distinct from old.creative_motivation
      or new.success_definition is distinct from old.success_definition
      or new.comparison_titles is distinct from old.comparison_titles
      or new.stage_turns is distinct from old.stage_turns
      or new.understanding_summary is distinct from old.understanding_summary
      or new.manuscript_version_id is distinct from old.manuscript_version_id
      or new.created_by is distinct from old.created_by
    then
      raise exception 'Confirmed editorial understanding records are immutable';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists editorial_understandings_immutable_confirmed on public.editorial_understandings;
create trigger editorial_understandings_immutable_confirmed
  before update on public.editorial_understandings
  for each row execute function public.editorial_understandings_immutable_confirmed();

-- Enforce at most one clarification per stage in stage_turns JSON
create or replace function public.editorial_understandings_one_clarification_per_stage()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  stage_item jsonb;
  stage_id text;
  clarification_count integer;
begin
  if new.stage_turns is null or jsonb_typeof(new.stage_turns) <> 'array' then
    return new;
  end if;

  for stage_id in
    select distinct elem->>'stage_id'
    from jsonb_array_elements(new.stage_turns) as elem
    where elem->>'stage_id' is not null
  loop
    select count(*)
    into clarification_count
    from jsonb_array_elements(new.stage_turns) as elem
    where elem->>'stage_id' = stage_id
      and coalesce((elem->>'clarification_used')::boolean, false) = true;

    if clarification_count > 1 then
      raise exception 'At most one clarification is allowed per stage (stage_id=%)', stage_id;
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists editorial_understandings_one_clarification_per_stage on public.editorial_understandings;
create trigger editorial_understandings_one_clarification_per_stage
  before insert or update of stage_turns on public.editorial_understandings
  for each row execute function public.editorial_understandings_one_clarification_per_stage();
