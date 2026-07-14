-- Authoritative manuscript statistics and transparent commercial fiction grading.
-- Atomic: columns + RPC replacement + grants.

BEGIN;

alter table public.reviews
  add column if not exists manuscript_score numeric(5, 2),
  add column if not exists manuscript_letter_grade text,
  add column if not exists craft_score numeric(5, 2),
  add column if not exists acquisition_readiness_score numeric(5, 2),
  add column if not exists grading_formula_version text,
  add column if not exists grade_status text,
  add column if not exists review_reliability_status text,
  add column if not exists canonical_word_count integer,
  add column if not exists words_analyzed integer,
  add column if not exists statistics_validation_status text,
  add column if not exists evidence_completeness_status text,
  add column if not exists arithmetic_validation_status text,
  add column if not exists rubric_breakdown jsonb,
  add column if not exists grading_metadata jsonb;

comment on column public.reviews.manuscript_score is 'Validated commercial rubric total (0-100). NULL for legacy/unverified reviews.';
comment on column public.reviews.rubric_breakdown is 'STORYDNA_COMMERCIAL_FICTION_RUBRIC_V1 category evidence JSON.';

-- Remove stale 6-argument overload from 0018 before creating the 7-argument function.
drop function if exists public.publish_commercial_review_generation(
  uuid,
  text,
  text,
  text,
  jsonb,
  jsonb
);

create or replace function public.publish_commercial_review_generation(
  p_manuscript_id uuid,
  p_provider text,
  p_model text,
  p_content text,
  p_metadata jsonb,
  p_payload jsonb,
  p_grading jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_response_count int;
  v_new_review_id uuid;
  v_replace_result jsonb;
  v_grade_status text;
  v_stats_status text;
  v_arith_status text;
  v_evidence_status text;
  v_formula text;
  v_manuscript_score numeric;
  v_craft_score numeric;
  v_acquisition_score numeric;
  v_canonical_words int;
  v_rubric jsonb;
begin
  if p_manuscript_id is null then
    raise exception 'MISSING_MANUSCRIPT_ID';
  end if;

  if p_provider is null or p_provider not in ('openai', 'anthropic') then
    raise exception 'INVALID_PROVIDER:%', p_provider;
  end if;

  if nullif(trim(coalesce(p_content, '')), '') is null then
    raise exception 'MISSING_REVIEW_CONTENT';
  end if;

  -- Grading validation BEFORE superseding the active commercial review.
  if p_grading is null or p_grading = 'null'::jsonb then
    raise exception 'INVALID_REVIEW_GRADING_PAYLOAD:missing p_grading';
  end if;

  v_grade_status := trim(coalesce(p_grading->>'grade_status', ''));
  if v_grade_status not in ('VERIFIED', 'PROVISIONAL_PARTIAL_COVERAGE') then
    raise exception 'INVALID_REVIEW_GRADING_PAYLOAD:grade_status=%', v_grade_status;
  end if;

  v_stats_status := upper(trim(coalesce(p_grading->>'statistics_validation_status', '')));
  if v_stats_status <> 'VERIFIED' then
    raise exception 'INVALID_REVIEW_GRADING_PAYLOAD:statistics_validation_status=%', v_stats_status;
  end if;

  v_arith_status := upper(trim(coalesce(p_grading->>'arithmetic_validation_status', '')));
  if v_arith_status <> 'VERIFIED' then
    raise exception 'INVALID_REVIEW_GRADING_PAYLOAD:arithmetic_validation_status=%', v_arith_status;
  end if;

  v_evidence_status := upper(trim(coalesce(p_grading->>'evidence_completeness_status', '')));
  if v_evidence_status <> 'COMPLETE' then
    raise exception 'INVALID_REVIEW_GRADING_PAYLOAD:evidence_completeness_status=%', v_evidence_status;
  end if;

  v_formula := trim(coalesce(p_grading->>'grading_formula_version', ''));
  if v_formula <> 'STORYDNA_COMMERCIAL_FICTION_RUBRIC_V1' then
    raise exception 'INVALID_REVIEW_GRADING_PAYLOAD:grading_formula_version=%', v_formula;
  end if;

  begin
    v_manuscript_score := nullif(trim(coalesce(p_grading->>'manuscript_score', '')), '')::numeric;
  exception when others then
    raise exception 'INVALID_REVIEW_GRADING_PAYLOAD:manuscript_score';
  end;
  if v_manuscript_score is null then
    raise exception 'INVALID_REVIEW_GRADING_PAYLOAD:manuscript_score missing';
  end if;

  begin
    v_craft_score := nullif(trim(coalesce(p_grading->>'craft_score', '')), '')::numeric;
  exception when others then
    raise exception 'INVALID_REVIEW_GRADING_PAYLOAD:craft_score';
  end;
  if v_craft_score is null then
    raise exception 'INVALID_REVIEW_GRADING_PAYLOAD:craft_score missing';
  end if;

  begin
    v_acquisition_score := nullif(trim(coalesce(p_grading->>'acquisition_readiness_score', '')), '')::numeric;
  exception when others then
    raise exception 'INVALID_REVIEW_GRADING_PAYLOAD:acquisition_readiness_score';
  end;
  if v_acquisition_score is null then
    raise exception 'INVALID_REVIEW_GRADING_PAYLOAD:acquisition_readiness_score missing';
  end if;

  begin
    v_canonical_words := nullif(trim(coalesce(p_grading->>'canonical_word_count', '')), '')::integer;
  exception when others then
    raise exception 'INVALID_REVIEW_GRADING_PAYLOAD:canonical_word_count';
  end;
  if v_canonical_words is null or v_canonical_words <= 0 then
    raise exception 'INVALID_REVIEW_GRADING_PAYLOAD:canonical_word_count=%', v_canonical_words;
  end if;

  v_rubric := p_grading->'rubric_breakdown';
  if v_rubric is null or v_rubric = 'null'::jsonb or v_rubric = '{}'::jsonb then
    raise exception 'INVALID_REVIEW_GRADING_PAYLOAD:rubric_breakdown missing';
  end if;

  perform public.acquire_manuscript_editorial_lock(p_manuscript_id);

  select count(*)::int
    into v_response_count
  from public.author_edit_responses aer
  where aer.manuscript_id = p_manuscript_id;

  if v_response_count > 0 then
    raise exception 'AUTHOR_RESPONSES_PRESENT:%', v_response_count;
  end if;

  update public.reviews
  set lifecycle_status = 'superseded'
  where manuscript_id = p_manuscript_id
    and perspective = 'commercial'
    and lifecycle_status = 'active';

  insert into public.reviews (
    manuscript_id,
    provider,
    perspective,
    model,
    content,
    metadata,
    lifecycle_status,
    manuscript_score,
    manuscript_letter_grade,
    craft_score,
    acquisition_readiness_score,
    grading_formula_version,
    grade_status,
    review_reliability_status,
    canonical_word_count,
    words_analyzed,
    statistics_validation_status,
    evidence_completeness_status,
    arithmetic_validation_status,
    rubric_breakdown,
    grading_metadata
  ) values (
    p_manuscript_id,
    p_provider,
    'commercial',
    p_model,
    p_content,
    p_metadata,
    'active',
    v_manuscript_score,
    nullif(trim(coalesce(p_grading->>'manuscript_letter_grade', '')), ''),
    v_craft_score,
    v_acquisition_score,
    v_formula,
    v_grade_status,
    nullif(trim(coalesce(p_grading->>'review_reliability_status', '')), ''),
    v_canonical_words,
    nullif(trim(coalesce(p_grading->>'words_analyzed', '')), '')::integer,
    v_stats_status,
    v_evidence_status,
    v_arith_status,
    v_rubric,
    p_grading->'grading_metadata'
  )
  returning id into v_new_review_id;

  v_replace_result := public.replace_editorial_generation(
    p_manuscript_id,
    v_new_review_id,
    p_payload
  );

  return jsonb_build_object(
    'review_id', v_new_review_id,
    'issue_count', v_replace_result->'issue_count',
    'candidate_count', v_replace_result->'candidate_count'
  );
end;
$$;

revoke all on function public.publish_commercial_review_generation(uuid, text, text, text, jsonb, jsonb, jsonb) from public;
revoke execute on function public.publish_commercial_review_generation(uuid, text, text, text, jsonb, jsonb, jsonb) from anon;
revoke execute on function public.publish_commercial_review_generation(uuid, text, text, text, jsonb, jsonb, jsonb) from authenticated;
grant execute on function public.publish_commercial_review_generation(uuid, text, text, text, jsonb, jsonb, jsonb) to service_role;

COMMIT;
