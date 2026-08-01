-- EIC Phase 1B-a · Author Manuscript Brief (conversational intake Stages 1–3)
-- Additive migration. Author framing only — not manuscript evidence.

-- ---------------------------------------------------------------------------
-- author_manuscript_briefs
-- ---------------------------------------------------------------------------
create table if not exists public.author_manuscript_briefs (
  id                        uuid primary key default gen_random_uuid(),
  book_id                   uuid not null references public.manuscripts(id) on delete cascade,
  manuscript_id             uuid not null references public.manuscripts(id) on delete cascade,
  manuscript_version_id     uuid not null,
  contract_version          text not null default 'storydna_author_manuscript_brief@v1',
  elevator_pitch            text not null default '',
  author_motivation         text not null default '',
  desired_reader_experience text null,
  market_position           text not null default 'unsure',
  comparison_titles         text null,
  success_definition        text null,
  status                    text not null default 'draft',
  created_by                text not null,
  submitted_at              timestamptz null,
  supersedes_brief_id       uuid null,
  superseded_at             timestamptz null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint author_manuscript_briefs_contract_version_check check (
    contract_version = 'storydna_author_manuscript_brief@v1'
  ),
  constraint author_manuscript_briefs_status_check check (
    status in ('draft', 'submitted', 'superseded', 'cancelled')
  ),
  constraint author_manuscript_briefs_book_manuscript_match check (
    book_id = manuscript_id
  ),
  constraint author_manuscript_briefs_version_fk foreign key (manuscript_version_id, manuscript_id)
    references public.manuscript_versions(id, manuscript_id) on delete restrict
);

create index if not exists author_manuscript_briefs_manuscript_idx
  on public.author_manuscript_briefs (manuscript_id);

create index if not exists author_manuscript_briefs_version_idx
  on public.author_manuscript_briefs (manuscript_version_id);

create index if not exists author_manuscript_briefs_status_idx
  on public.author_manuscript_briefs (status);

create unique index if not exists author_manuscript_briefs_one_draft_per_author_version
  on public.author_manuscript_briefs (manuscript_id, manuscript_version_id, created_by)
  where status = 'draft';

create unique index if not exists author_manuscript_briefs_one_submitted_per_version
  on public.author_manuscript_briefs (manuscript_id, manuscript_version_id)
  where status = 'submitted';

alter table public.author_manuscript_briefs
  drop constraint if exists author_manuscript_briefs_supersedes_fk;

alter table public.author_manuscript_briefs
  add constraint author_manuscript_briefs_supersedes_fk
  foreign key (supersedes_brief_id) references public.author_manuscript_briefs(id) on delete set null;

drop trigger if exists author_manuscript_briefs_set_updated_at on public.author_manuscript_briefs;
create trigger author_manuscript_briefs_set_updated_at
  before update on public.author_manuscript_briefs
  for each row execute function set_updated_at();

-- Prevent mutation of submitted brief content (status transitions only via service)
create or replace function public.author_manuscript_briefs_immutable_submitted()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.status = 'submitted' and new.status = 'submitted' then
    if new.elevator_pitch is distinct from old.elevator_pitch
      or new.author_motivation is distinct from old.author_motivation
      or new.desired_reader_experience is distinct from old.desired_reader_experience
      or new.market_position is distinct from old.market_position
      or new.comparison_titles is distinct from old.comparison_titles
      or new.success_definition is distinct from old.success_definition
      or new.manuscript_version_id is distinct from old.manuscript_version_id
      or new.created_by is distinct from old.created_by
    then
      raise exception 'Submitted manuscript briefs are immutable';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists author_manuscript_briefs_immutable_submitted on public.author_manuscript_briefs;
create trigger author_manuscript_briefs_immutable_submitted
  before update on public.author_manuscript_briefs
  for each row execute function public.author_manuscript_briefs_immutable_submitted();
