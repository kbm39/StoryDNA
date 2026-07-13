-- Atomic editorial replacement + coordinated author-response locking.
--
-- Database objects (all in public schema):
--   1. public.manuscript_passage_located(text, text) → boolean  (internal helper)
--   2. public.acquire_manuscript_editorial_lock(uuid) → void
--   3. public.replace_editorial_generation(uuid, uuid, jsonb) → jsonb
--   4. public.upsert_author_edit_response(uuid, uuid, text, text, text) → jsonb
--
-- Advisory lock key strategy (shared by replacement + author-response paths):
--   pg_advisory_xact_lock(
--     hashtext('storydna_manuscript_editorial'),  -- namespace key
--     hashtext(p_manuscript_id::text)             -- per-manuscript key
--   )
-- Transaction-scoped: released on COMMIT/ROLLBACK of the calling RPC.
--
-- Manuscript text for passage verification is loaded from public.manuscripts.extracted_text
-- inside replace_editorial_generation — never from caller-supplied parameters.
--
-- Does NOT delete/update author_edit_responses in replace_editorial_generation.
-- Does NOT modify manuscripts.extracted_text.

-- ---------------------------------------------------------------------------
-- Helper: locate a passage in manuscript text (direct or whitespace-normalized)
-- Internal only — not granted to any client role.
-- ---------------------------------------------------------------------------
create or replace function public.manuscript_passage_located(
  p_manuscript_text text,
  p_passage text
) returns boolean
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  v_passage text;
  v_hay text;
  v_needle text;
begin
  v_passage := nullif(trim(p_passage), '');
  if v_passage is null or length(v_passage) < 8 then
    return false;
  end if;
  if p_manuscript_text is null or trim(p_manuscript_text) = '' then
    return false;
  end if;

  if position(v_passage in p_manuscript_text) > 0 then
    return true;
  end if;

  v_hay := lower(regexp_replace(trim(p_manuscript_text), '\s+', ' ', 'g'));
  v_needle := lower(regexp_replace(v_passage, '\s+', ' ', 'g'));
  return position(v_needle in v_hay) > 0;
end;
$$;

revoke all on function public.manuscript_passage_located(text, text) from public;
revoke execute on function public.manuscript_passage_located(text, text) from anon;
revoke execute on function public.manuscript_passage_located(text, text) from authenticated;
revoke execute on function public.manuscript_passage_located(text, text) from service_role;

-- ---------------------------------------------------------------------------
-- Shared manuscript advisory lock (author-response + replacement workflows)
-- ---------------------------------------------------------------------------
create or replace function public.acquire_manuscript_editorial_lock(
  p_manuscript_id uuid
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_manuscript_id is null then
    raise exception 'MISSING_MANUSCRIPT_ID';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('storydna_manuscript_editorial'),
    hashtext(p_manuscript_id::text)
  );
end;
$$;

revoke all on function public.acquire_manuscript_editorial_lock(uuid) from public;
revoke execute on function public.acquire_manuscript_editorial_lock(uuid) from anon;
revoke execute on function public.acquire_manuscript_editorial_lock(uuid) from authenticated;
grant execute on function public.acquire_manuscript_editorial_lock(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Author response upsert (holds advisory lock for full transaction)
--
-- Validates inside the locked transaction:
--   - candidate exists
--   - candidate belongs to p_manuscript_id
--   - disposition ∈ accepted | rejected | modified | skipped
--   - modified requires non-empty author_modified_text
--   - non-modified dispositions clear author_modified_text (never overwrites proposal)
-- Does NOT modify manuscripts.extracted_text.
-- Does NOT update revision_candidates.status (editorial lifecycle stays separate).
-- ---------------------------------------------------------------------------
create or replace function public.upsert_author_edit_response(
  p_candidate_id uuid,
  p_manuscript_id uuid,
  p_disposition text,
  p_author_modified_text text,
  p_author_note text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_candidate_manuscript_id uuid;
  v_existing_id uuid;
  v_now timestamptz := now();
begin
  if p_candidate_id is null or p_manuscript_id is null then
    raise exception 'MISSING_CANDIDATE_OR_MANUSCRIPT';
  end if;

  if p_disposition not in ('accepted', 'rejected', 'modified', 'skipped') then
    raise exception 'INVALID_DISPOSITION:%', p_disposition;
  end if;

  if p_disposition = 'modified' and nullif(trim(coalesce(p_author_modified_text, '')), '') is null then
    raise exception 'MODIFIED_TEXT_REQUIRED';
  end if;

  perform public.acquire_manuscript_editorial_lock(p_manuscript_id);

  if not exists (
    select 1 from public.manuscripts m where m.id = p_manuscript_id
  ) then
    raise exception 'MANUSCRIPT_NOT_FOUND:%', p_manuscript_id;
  end if;

  select rc.manuscript_id
    into v_candidate_manuscript_id
  from public.revision_candidates rc
  where rc.id = p_candidate_id;

  if v_candidate_manuscript_id is null then
    raise exception 'CANDIDATE_NOT_FOUND:%', p_candidate_id;
  end if;

  if v_candidate_manuscript_id <> p_manuscript_id then
    raise exception 'CANDIDATE_MANUSCRIPT_MISMATCH';
  end if;

  select aer.id
    into v_existing_id
  from public.author_edit_responses aer
  where aer.candidate_id = p_candidate_id;

  if v_existing_id is null then
    insert into public.author_edit_responses (
      candidate_id,
      manuscript_id,
      disposition,
      author_modified_text,
      author_note,
      responded_at,
      updated_at
    ) values (
      p_candidate_id,
      p_manuscript_id,
      p_disposition,
      case when p_disposition = 'modified' then nullif(trim(p_author_modified_text), '') else null end,
      nullif(trim(coalesce(p_author_note, '')), ''),
      v_now,
      v_now
    );
  else
    update public.author_edit_responses
    set
      disposition = p_disposition,
      author_modified_text = case
        when p_disposition = 'modified' then nullif(trim(p_author_modified_text), '')
        else null
      end,
      author_note = nullif(trim(coalesce(p_author_note, '')), ''),
      updated_at = v_now
    where id = v_existing_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.upsert_author_edit_response(uuid, uuid, text, text, text) from public;
revoke execute on function public.upsert_author_edit_response(uuid, uuid, text, text, text) from anon;
revoke execute on function public.upsert_author_edit_response(uuid, uuid, text, text, text) from authenticated;
grant execute on function public.upsert_author_edit_response(uuid, uuid, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Atomic replacement of editorial issues + revision candidates
--
-- Manuscript text is loaded from public.manuscripts.extracted_text after the
-- advisory lock is held. Caller-supplied text is never accepted. verified is
-- computed solely from database-loaded text via public.manuscript_passage_located.
-- ---------------------------------------------------------------------------
create or replace function public.replace_editorial_generation(
  p_manuscript_id uuid,
  p_review_id uuid,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_response_count int;
  v_issue jsonb;
  v_candidate jsonb;
  v_issue_id uuid;
  v_issue_count int := 0;
  v_candidate_count int := 0;
  v_severity text;
  v_issue_text text;
  v_export_mode text;
  v_candidate_type text;
  v_verified boolean;
  v_review_manuscript_id uuid;
  v_original text;
  v_manuscript_text text;
  v_payload_verified boolean;
begin
  if p_manuscript_id is null then
    raise exception 'MISSING_MANUSCRIPT_ID';
  end if;

  if p_review_id is null then
    raise exception 'MISSING_REVIEW_ID';
  end if;

  perform public.acquire_manuscript_editorial_lock(p_manuscript_id);

  select m.extracted_text
    into v_manuscript_text
  from public.manuscripts m
  where m.id = p_manuscript_id;

  if not found then
    raise exception 'MANUSCRIPT_NOT_FOUND:%', p_manuscript_id;
  end if;

  select r.manuscript_id
    into v_review_manuscript_id
  from public.reviews r
  where r.id = p_review_id;

  if v_review_manuscript_id is null then
    raise exception 'REVIEW_NOT_FOUND:%', p_review_id;
  end if;

  if v_review_manuscript_id <> p_manuscript_id then
    raise exception 'REVIEW_MANUSCRIPT_MISMATCH';
  end if;

  select count(*)::int
    into v_response_count
  from public.author_edit_responses aer
  where aer.manuscript_id = p_manuscript_id;

  if v_response_count > 0 then
    raise exception 'AUTHOR_RESPONSES_PRESENT:%', v_response_count;
  end if;

  if p_payload is null or jsonb_typeof(p_payload->'issues') <> 'array' then
    raise exception 'INVALID_PAYLOAD:issues_must_be_array';
  end if;

  delete from public.revision_candidates where manuscript_id = p_manuscript_id;
  delete from public.editorial_issues where manuscript_id = p_manuscript_id;

  for v_issue in select value from jsonb_array_elements(p_payload->'issues')
  loop
    v_issue_text := nullif(trim(v_issue->>'text'), '');
    if v_issue_text is null then
      raise exception 'ISSUE_TEXT_REQUIRED';
    end if;

    if v_issue ? 'candidates' and jsonb_typeof(v_issue->'candidates') <> 'array' then
      raise exception 'INVALID_CANDIDATES_ARRAY';
    end if;

    v_severity := coalesce(nullif(v_issue->>'severity', ''), 'medium');
    if v_severity not in ('low', 'medium', 'high') then
      raise exception 'INVALID_SEVERITY:%', v_severity;
    end if;

    insert into public.editorial_issues (
      manuscript_id,
      review_id,
      text,
      area,
      severity,
      source_section,
      success_criterion,
      owning_reviewer,
      resolution_status
    ) values (
      p_manuscript_id,
      p_review_id,
      v_issue_text,
      nullif(v_issue->>'area', ''),
      v_severity,
      nullif(v_issue->>'source_section', ''),
      nullif(v_issue->>'success_criterion', ''),
      'Literary Agent',
      'open'
    )
    returning id into v_issue_id;

    v_issue_count := v_issue_count + 1;

    if jsonb_typeof(v_issue->'candidates') = 'array' then
      for v_candidate in select value from jsonb_array_elements(v_issue->'candidates')
      loop
        v_original := nullif(trim(v_candidate->>'original'), '');
        if v_original is null then
          raise exception 'CANDIDATE_ORIGINAL_REQUIRED';
        end if;

        v_candidate_type := coalesce(nullif(v_candidate->>'type', ''), 'comment_only');
        if nullif(trim(v_candidate_type), '') is null then
          raise exception 'INVALID_CANDIDATE_TYPE';
        end if;

        v_export_mode := coalesce(nullif(v_candidate->>'export_mode', ''), 'track_change');
        if v_export_mode not in ('track_change', 'comment') then
          raise exception 'INVALID_EXPORT_MODE:%', v_export_mode;
        end if;

        v_payload_verified := coalesce((v_candidate->>'verified')::boolean, false);
        if v_payload_verified and nullif(trim(coalesce(v_manuscript_text, '')), '') is null then
          raise exception 'EXTRACTED_TEXT_REQUIRED_FOR_VERIFICATION';
        end if;

        v_verified := case
          when nullif(trim(coalesce(v_manuscript_text, '')), '') is null then false
          else public.manuscript_passage_located(v_manuscript_text, v_original)
        end;

        if v_payload_verified and not v_verified then
          raise exception 'VERIFIED_PASSAGE_NOT_LOCATED';
        end if;

        insert into public.revision_candidates (
          manuscript_id,
          issue_id,
          type,
          original,
          revised,
          locator,
          word_savings,
          reason,
          confidence,
          confidence_reason,
          difficulty,
          story_risk,
          voice_risk,
          commercial_impact,
          reader_impact,
          grade_delta,
          consequence_if_unchanged,
          dependencies,
          impacts,
          export_mode,
          verified,
          status
        ) values (
          p_manuscript_id,
          v_issue_id,
          v_candidate_type,
          v_original,
          coalesce(v_candidate->>'revised', ''),
          nullif(v_candidate->>'locator', ''),
          coalesce((v_candidate->>'word_savings')::int, 0),
          nullif(v_candidate->>'reason', ''),
          coalesce((v_candidate->>'confidence')::int, 0),
          nullif(v_candidate->>'confidence_reason', ''),
          nullif(v_candidate->>'difficulty', ''),
          nullif(v_candidate->>'story_risk', ''),
          nullif(v_candidate->>'voice_risk', ''),
          nullif(v_candidate->>'commercial_impact', ''),
          nullif(v_candidate->>'reader_impact', ''),
          coalesce((v_candidate->>'grade_delta')::int, 0),
          nullif(v_candidate->>'consequence_if_unchanged', ''),
          nullif(v_candidate->>'dependencies', ''),
          coalesce(v_candidate->'impacts', '{}'::jsonb),
          v_export_mode,
          v_verified,
          'proposed'
        );
        v_candidate_count := v_candidate_count + 1;
      end loop;
    end if;
  end loop;

  return jsonb_build_object(
    'issue_count', v_issue_count,
    'candidate_count', v_candidate_count
  );
end;
$$;

revoke all on function public.replace_editorial_generation(uuid, uuid, jsonb) from public;
revoke execute on function public.replace_editorial_generation(uuid, uuid, jsonb) from anon;
revoke execute on function public.replace_editorial_generation(uuid, uuid, jsonb) from authenticated;
grant execute on function public.replace_editorial_generation(uuid, uuid, jsonb) to service_role;
