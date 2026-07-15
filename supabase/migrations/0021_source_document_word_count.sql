-- Dual word-count reporting: StoryDNA analytical (word_count) vs Microsoft Word embedded DOCX count.

alter table public.manuscripts
  add column if not exists source_document_word_count integer;

alter table public.manuscript_versions
  add column if not exists source_document_word_count integer;

comment on column public.manuscripts.source_document_word_count is
  'Microsoft Word <Words> from docProps/app.xml at upload; never replaces canonical word_count.';
comment on column public.manuscript_versions.source_document_word_count is
  'Microsoft Word <Words> from docProps/app.xml for this version snapshot.';

-- Mirror source_document_word_count when promoting a version to current.
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
  select mv.*
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
      source_document_word_count = v_version.source_document_word_count,
      extracted_text = v_version.extracted_text
    where m.id = p_manuscript_id
      and m.current_version_id = p_version_id;
  end if;
end;
$$;

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
    mv.source_document_word_count,
    mv.extracted_text
    into
    new.original_filename,
    new.storage_path,
    new.file_size,
    new.word_count,
    new.source_document_word_count,
    new.extracted_text
  from public.manuscript_versions mv
  where mv.id = new.current_version_id
    and mv.manuscript_id = new.id;

  return new;
end;
$$;

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
    source_document_word_count,
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
    new.source_document_word_count,
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

  return new;
end;
$$;
