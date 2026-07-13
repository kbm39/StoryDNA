-- Manuscript Versioning · Phase 1: schema + backfill only.
-- manuscripts = stable project identity; manuscript_versions = immutable content snapshots.
-- current_version_id is the sole authoritative current-version pointer.
-- Phase 1 hash: SHA-256 of raw UTF-8 extracted_text bytes (no NFKC / markup normalization).

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Content hash — canonical Phase 1 version hash (raw UTF-8 text, not NFKC).
-- ---------------------------------------------------------------------------
create or replace function public.manuscript_content_hash(p_text text)
returns text
language sql
immutable
set search_path = pg_catalog, public, extensions
as $$
  select encode(extensions.digest(convert_to(coalesce(p_text, ''), 'UTF8'), 'sha256'), 'hex');
$$;

revoke all on function public.manuscript_content_hash(text) from public;
revoke execute on function public.manuscript_content_hash(text) from anon;
revoke execute on function public.manuscript_content_hash(text) from authenticated;

-- ---------------------------------------------------------------------------
-- Internal flag: only authoritative current-version paths may flip is_current.
-- ---------------------------------------------------------------------------
create or replace function public.manuscript_versions_is_current_change_allowed()
returns boolean
language sql
stable
set search_path = pg_catalog, public
as $$
  select coalesce(current_setting('storydna.allow_version_current_change', true), '') = '1';
$$;

create or replace function public.manuscript_versions_set_current_change_allowed(p_allowed boolean)
returns void
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  perform set_config(
    'storydna.allow_version_current_change',
    case when p_allowed then '1' else '0' end,
    true
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- manuscript_versions
-- ---------------------------------------------------------------------------
create table if not exists public.manuscript_versions (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references public.manuscripts(id) on delete cascade,
  version_number int not null check (version_number > 0),
  label text,
  source_filename text not null,
  storage_path text not null,
  file_size bigint,
  extracted_text text,
  word_count int,
  character_count int,
  content_hash text not null,
  uploaded_at timestamptz not null default now(),
  notes text,
  supersedes_version_id uuid references public.manuscript_versions(id) on delete set null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  constraint manuscript_versions_unique_number unique (manuscript_id, version_number),
  constraint manuscript_versions_id_manuscript_unique unique (id, manuscript_id)
);

create index if not exists manuscript_versions_manuscript_idx
  on public.manuscript_versions (manuscript_id);

create index if not exists manuscript_versions_content_hash_idx
  on public.manuscript_versions (manuscript_id, content_hash);

-- is_current is derived from manuscripts.current_version_id (enforced by trigger below).
-- Partial index documents intent; authoritative pointer is manuscripts.current_version_id.
create unique index if not exists manuscript_versions_one_current_per_manuscript
  on public.manuscript_versions (manuscript_id)
  where is_current;

-- ---------------------------------------------------------------------------
-- manuscripts.current_version_id (authoritative current-version pointer)
-- ---------------------------------------------------------------------------
alter table public.manuscripts
  add column if not exists current_version_id uuid;

-- ---------------------------------------------------------------------------
-- Backfill version 1 for every existing manuscript (idempotent)
-- ---------------------------------------------------------------------------
insert into public.manuscript_versions (
  manuscript_id,
  version_number,
  label,
  source_filename,
  storage_path,
  file_size,
  extracted_text,
  word_count,
  character_count,
  content_hash,
  uploaded_at,
  supersedes_version_id,
  is_current,
  created_at
)
select
  m.id,
  1,
  'Initial version',
  m.original_filename,
  m.storage_path,
  m.file_size,
  m.extracted_text,
  m.word_count,
  length(coalesce(m.extracted_text, '')),
  public.manuscript_content_hash(m.extracted_text),
  m.created_at,
  null,
  false,
  m.created_at
from public.manuscripts m
where not exists (
  select 1
  from public.manuscript_versions mv
  where mv.manuscript_id = m.id
);

-- Point manuscripts at their version-1 row (triggers not yet installed).
update public.manuscripts m
set current_version_id = mv.id
from public.manuscript_versions mv
where mv.manuscript_id = m.id
  and mv.version_number = 1
  and m.current_version_id is null;

-- Align is_current with authoritative pointer (pre-trigger backfill).
update public.manuscript_versions mv
set is_current = (mv.id = m.current_version_id)
from public.manuscripts m
where mv.manuscript_id = m.id;

alter table public.manuscripts drop constraint if exists manuscripts_current_version_id_fkey;
alter table public.manuscripts
  add constraint manuscripts_current_version_id_fkey
  foreign key (current_version_id) references public.manuscript_versions(id) on delete restrict;

-- ---------------------------------------------------------------------------
-- Version FK on editorial / review tables (dual-FK: retain manuscript_id)
-- ---------------------------------------------------------------------------
alter table public.reviews
  add column if not exists manuscript_version_id uuid;

alter table public.editorial_issues
  add column if not exists manuscript_version_id uuid;

alter table public.revision_candidates
  add column if not exists manuscript_version_id uuid;

alter table public.author_edit_responses
  add column if not exists manuscript_version_id uuid;

update public.reviews r
set manuscript_version_id = m.current_version_id
from public.manuscripts m
where r.manuscript_id = m.id
  and r.manuscript_version_id is null
  and m.current_version_id is not null;

update public.editorial_issues ei
set manuscript_version_id = m.current_version_id
from public.manuscripts m
where ei.manuscript_id = m.id
  and ei.manuscript_version_id is null
  and m.current_version_id is not null;

update public.revision_candidates rc
set manuscript_version_id = m.current_version_id
from public.manuscripts m
where rc.manuscript_id = m.id
  and rc.manuscript_version_id is null
  and m.current_version_id is not null;

update public.author_edit_responses aer
set manuscript_version_id = m.current_version_id
from public.manuscripts m
where aer.manuscript_id = m.id
  and aer.manuscript_version_id is null
  and m.current_version_id is not null;

-- Require version ownership on all editorial rows (prevents NULL bypass of uniqueness).
alter table public.reviews
  alter column manuscript_version_id set not null;

alter table public.editorial_issues
  alter column manuscript_version_id set not null;

alter table public.revision_candidates
  alter column manuscript_version_id set not null;

alter table public.author_edit_responses
  alter column manuscript_version_id set not null;

-- Drop legacy single-column FKs if present from a prior partial apply.
alter table public.reviews drop constraint if exists reviews_manuscript_version_id_fkey;
alter table public.editorial_issues drop constraint if exists editorial_issues_manuscript_version_id_fkey;
alter table public.revision_candidates drop constraint if exists revision_candidates_manuscript_version_id_fkey;
alter table public.author_edit_responses drop constraint if exists author_edit_responses_manuscript_version_id_fkey;

-- Composite ownership FKs — RESTRICT prevents silent cascade deletion of editorial history.
alter table public.reviews
  add constraint reviews_version_manuscript_fkey
  foreign key (manuscript_version_id, manuscript_id)
  references public.manuscript_versions (id, manuscript_id)
  on delete restrict;

alter table public.editorial_issues
  add constraint editorial_issues_version_manuscript_fkey
  foreign key (manuscript_version_id, manuscript_id)
  references public.manuscript_versions (id, manuscript_id)
  on delete restrict;

alter table public.revision_candidates
  add constraint revision_candidates_version_manuscript_fkey
  foreign key (manuscript_version_id, manuscript_id)
  references public.manuscript_versions (id, manuscript_id)
  on delete restrict;

alter table public.author_edit_responses
  add constraint author_edit_responses_version_manuscript_fkey
  foreign key (manuscript_version_id, manuscript_id)
  references public.manuscript_versions (id, manuscript_id)
  on delete restrict;

create index if not exists reviews_manuscript_version_idx
  on public.reviews (manuscript_version_id);

create index if not exists editorial_issues_manuscript_version_idx
  on public.editorial_issues (manuscript_version_id);

create index if not exists revision_candidates_manuscript_version_idx
  on public.revision_candidates (manuscript_version_id);

create index if not exists author_edit_responses_manuscript_version_idx
  on public.author_edit_responses (manuscript_version_id);

-- Commercial review uniqueness: one active per version (manuscript_version_id NOT NULL above).
drop index if exists public.reviews_one_active_commercial_per_manuscript;

create unique index if not exists reviews_one_active_commercial_per_version
  on public.reviews (manuscript_version_id)
  where perspective = 'commercial' and lifecycle_status = 'active';

-- ---------------------------------------------------------------------------
-- Authoritative current-version application (internal; used by triggers).
-- Sets is_current flags and optionally mirrors version content → manuscripts.
-- ---------------------------------------------------------------------------
create or replace function public.apply_manuscript_current_version(
  p_manuscript_id uuid,
  p_version_id uuid,
  p_mirror_content_to_manuscript boolean default false
)
returns void
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_version public.manuscript_versions%rowtype;
begin
  if p_manuscript_id is null or p_version_id is null then
    raise exception 'MISSING_MANUSCRIPT_OR_VERSION_ID';
  end if;

  select *
    into v_version
  from public.manuscript_versions mv
  where mv.id = p_version_id
    and mv.manuscript_id = p_manuscript_id;

  if not found then
    raise exception 'VERSION_MANUSCRIPT_MISMATCH:manuscript=% version=%', p_manuscript_id, p_version_id;
  end if;

  perform public.manuscript_versions_set_current_change_allowed(true);

  update public.manuscript_versions
  set is_current = false
  where manuscript_id = p_manuscript_id
    and is_current
    and id is distinct from p_version_id;

  update public.manuscript_versions
  set is_current = true
  where id = p_version_id
    and manuscript_id = p_manuscript_id;

  perform public.manuscript_versions_set_current_change_allowed(false);

  if p_mirror_content_to_manuscript then
    update public.manuscripts m
    set
      original_filename = v_version.source_filename,
      storage_path = v_version.storage_path,
      file_size = v_version.file_size,
      word_count = v_version.word_count,
      extracted_text = v_version.extracted_text
    where m.id = p_manuscript_id
      and m.current_version_id = p_version_id;
  end if;
end;
$$;

revoke all on function public.apply_manuscript_current_version(uuid, uuid, boolean) from public;
revoke execute on function public.apply_manuscript_current_version(uuid, uuid, boolean) from anon;
revoke execute on function public.apply_manuscript_current_version(uuid, uuid, boolean) from authenticated;
grant execute on function public.apply_manuscript_current_version(uuid, uuid, boolean) to service_role;

-- BEFORE UPDATE manuscripts.current_version_id — sole promotion path.
create or replace function public.manuscripts_before_current_version_change()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.current_version_id is null then
    raise exception 'CURRENT_VERSION_ID_REQUIRED';
  end if;

  if new.current_version_id is not distinct from old.current_version_id then
    return new;
  end if;

  perform public.apply_manuscript_current_version(
    new.id,
    new.current_version_id,
    false
  );

  select
    mv.source_filename,
    mv.storage_path,
    mv.file_size,
    mv.word_count,
    mv.extracted_text
    into
    new.original_filename,
    new.storage_path,
    new.file_size,
    new.word_count,
    new.extracted_text
  from public.manuscript_versions mv
  where mv.id = new.current_version_id
    and mv.manuscript_id = new.id;

  return new;
end;
$$;

-- AFTER UPDATE manuscripts content columns → current version only (Phase 1 legacy write path).
create or replace function public.manuscripts_sync_content_to_current_version()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.current_version_id is null then
    return new;
  end if;

  if old.current_version_id is distinct from new.current_version_id then
    return new;
  end if;

  update public.manuscript_versions mv
  set
    source_filename = new.original_filename,
    storage_path = new.storage_path,
    file_size = new.file_size,
    word_count = new.word_count,
    extracted_text = new.extracted_text,
    character_count = length(coalesce(new.extracted_text, '')),
    content_hash = public.manuscript_content_hash(new.extracted_text)
  where mv.id = new.current_version_id
    and mv.manuscript_id = new.id
    and mv.is_current
    and (
      mv.source_filename is distinct from new.original_filename
      or mv.storage_path is distinct from new.storage_path
      or mv.file_size is distinct from new.file_size
      or mv.word_count is distinct from new.word_count
      or mv.extracted_text is distinct from new.extracted_text
    );

  return new;
end;
$$;

-- AFTER INSERT manuscripts — auto-create version 1 (upload compatibility, no TS changes).
create or replace function public.manuscripts_after_insert_create_version()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_version_id uuid;
begin
  if exists (
    select 1 from public.manuscript_versions mv where mv.manuscript_id = new.id
  ) then
    return new;
  end if;

  insert into public.manuscript_versions (
    manuscript_id,
    version_number,
    label,
    source_filename,
    storage_path,
    file_size,
    extracted_text,
    word_count,
    character_count,
    content_hash,
    uploaded_at,
    supersedes_version_id,
    is_current,
    created_at
  ) values (
    new.id,
    1,
    'Initial version',
    new.original_filename,
    new.storage_path,
    new.file_size,
    new.extracted_text,
    new.word_count,
    length(coalesce(new.extracted_text, '')),
    public.manuscript_content_hash(new.extracted_text),
    coalesce(new.created_at, now()),
    null,
    false,
    coalesce(new.created_at, now())
  )
  returning id into v_version_id;

  update public.manuscripts m
  set current_version_id = v_version_id
  where m.id = new.id
    and m.current_version_id is null;

  -- manuscripts_before_current_version applies is_current + legacy mirror.
  return new;
end;
$$;

-- Reject direct is_current changes outside authoritative paths.
create or replace function public.manuscript_versions_reject_direct_is_current_change()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.is_current is not distinct from new.is_current then
    return new;
  end if;

  if public.manuscript_versions_is_current_change_allowed() then
    return new;
  end if;

  raise exception 'IS_CURRENT_CHANGE_BLOCKED:update manuscripts.current_version_id instead';
end;
$$;

-- Block deletion of the current version (and any version referenced as current).
create or replace function public.manuscript_versions_block_delete_current()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.is_current then
    raise exception 'CURRENT_VERSION_DELETE_BLOCKED:%', old.id;
  end if;

  if exists (
    select 1
    from public.manuscripts m
    where m.current_version_id = old.id
  ) then
    raise exception 'CURRENT_VERSION_DELETE_BLOCKED:%', old.id;
  end if;

  return old;
end;
$$;

-- Auto-populate manuscript_version_id on INSERT when RPC omits it (Phase 1 compatibility).
create or replace function public.auto_set_manuscript_version_id()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.manuscript_version_id is not null then
    return new;
  end if;

  select m.current_version_id
    into new.manuscript_version_id
  from public.manuscripts m
  where m.id = new.manuscript_id;

  if new.manuscript_version_id is null then
    raise exception 'MANUSCRIPT_VERSION_REQUIRED:manuscript=%', new.manuscript_id;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers (minimal set)
-- ---------------------------------------------------------------------------
drop trigger if exists manuscripts_before_current_version on public.manuscripts;
create trigger manuscripts_before_current_version
  before update of current_version_id on public.manuscripts
  for each row
  execute function public.manuscripts_before_current_version_change();

drop trigger if exists manuscripts_sync_content_to_current_version on public.manuscripts;
create trigger manuscripts_sync_content_to_current_version
  after update of original_filename, storage_path, file_size, word_count, extracted_text
  on public.manuscripts
  for each row
  execute function public.manuscripts_sync_content_to_current_version();

drop trigger if exists manuscripts_after_insert_create_version on public.manuscripts;
create trigger manuscripts_after_insert_create_version
  after insert on public.manuscripts
  for each row
  execute function public.manuscripts_after_insert_create_version();

drop trigger if exists manuscript_versions_reject_direct_is_current on public.manuscript_versions;
create trigger manuscript_versions_reject_direct_is_current
  before update of is_current on public.manuscript_versions
  for each row
  execute function public.manuscript_versions_reject_direct_is_current_change();

drop trigger if exists manuscript_versions_block_delete_current on public.manuscript_versions;
create trigger manuscript_versions_block_delete_current
  before delete on public.manuscript_versions
  for each row
  execute function public.manuscript_versions_block_delete_current();

drop trigger if exists reviews_auto_manuscript_version on public.reviews;
create trigger reviews_auto_manuscript_version
  before insert on public.reviews
  for each row
  execute function public.auto_set_manuscript_version_id();

drop trigger if exists editorial_issues_auto_manuscript_version on public.editorial_issues;
create trigger editorial_issues_auto_manuscript_version
  before insert on public.editorial_issues
  for each row
  execute function public.auto_set_manuscript_version_id();

drop trigger if exists revision_candidates_auto_manuscript_version on public.revision_candidates;
create trigger revision_candidates_auto_manuscript_version
  before insert on public.revision_candidates
  for each row
  execute function public.auto_set_manuscript_version_id();

drop trigger if exists author_edit_responses_auto_manuscript_version on public.author_edit_responses;
create trigger author_edit_responses_auto_manuscript_version
  before insert on public.author_edit_responses
  for each row
  execute function public.auto_set_manuscript_version_id();

-- Remove superseded triggers from prior draft (idempotent cleanup).
drop trigger if exists reviews_enforce_version_manuscript on public.reviews;
drop trigger if exists editorial_issues_enforce_version_manuscript on public.editorial_issues;
drop trigger if exists revision_candidates_enforce_version_manuscript on public.revision_candidates;
drop trigger if exists author_edit_responses_enforce_version_manuscript on public.author_edit_responses;
drop trigger if exists manuscript_versions_sync_to_manuscript on public.manuscript_versions;
drop trigger if exists manuscripts_sync_to_current_version on public.manuscripts;

drop function if exists public.enforce_manuscript_version_manuscript_match();
drop function if exists public.sync_manuscript_from_current_version();
drop function if exists public.sync_current_version_from_manuscript();
