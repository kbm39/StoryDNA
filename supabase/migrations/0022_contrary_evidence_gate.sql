-- Universal Contrary-Evidence Gate (Phase 2): persistence + RPC extension.

BEGIN;

alter table public.reviews
  add column if not exists contrary_evidence_gate_status text,
  add column if not exists contrary_evidence_gate_version text,
  add column if not exists scoring_gate_valid boolean,
  add column if not exists duplicate_deduction_count integer,
  add column if not exists restored_points_total numeric(5, 2),
  add column if not exists blocked_stale_deduction_count integer;

comment on column public.reviews.contrary_evidence_gate_status is
  'skipped | completed | required_not_run | failed';
comment on column public.reviews.scoring_gate_valid is
  'False when revision-aware validation incomplete — grade must be withheld in UI.';

create table if not exists public.review_concern_assessments (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  prior_review_id uuid references public.reviews(id) on delete set null,
  manuscript_id uuid not null references public.manuscripts(id) on delete cascade,
  manuscript_version_id uuid references public.manuscript_versions(id) on delete set null,
  prior_manuscript_version_id uuid references public.manuscript_versions(id) on delete set null,
  concern_id text not null,
  root_issue text not null,
  source_type text not null,
  rubric_category text,
  prior_criticism text not null,
  prior_evidence jsonb not null default '[]'::jsonb,
  current_supporting_evidence jsonb not null default '[]'::jsonb,
  current_contrary_evidence jsonb not null default '[]'::jsonb,
  revision_change jsonb,
  original_basis_still_present boolean not null default false,
  status text not null,
  confidence text not null,
  prior_deduction numeric(5, 2) not null default 0,
  points_restored numeric(5, 2) not null default 0,
  remaining_deduction numeric(5, 2) not null default 0,
  narrowed_current_finding text,
  explanation text not null,
  created_at timestamptz not null default now()
);

create index if not exists review_concern_assessments_review_idx
  on public.review_concern_assessments (review_id);

create index if not exists review_concern_assessments_manuscript_idx
  on public.review_concern_assessments (manuscript_id);

-- Extend publish RPC to persist gate metadata and concern assessments.
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
  v_scoring_gate_valid boolean;
  v_assessment jsonb;
  v_manuscript_version_id uuid;
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

  -- Gate-required reviews must have scoring_gate_valid = true
  v_scoring_gate_valid := coalesce((p_grading->>'scoring_gate_valid')::boolean, true);
  if coalesce(p_grading->>'contrary_evidence_gate_status', '') in ('required_not_run', 'failed') then
    raise exception 'CONTRARY_EVIDENCE_GATE_INCOMPLETE';
  end if;
  if coalesce(p_grading->>'contrary_evidence_gate_status', '') = 'completed' and not v_scoring_gate_valid then
    raise exception 'SCORING_GATE_INVALID';
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

  begin
    v_manuscript_version_id := nullif(trim(coalesce(p_grading->>'manuscript_version_id', '')), '')::uuid;
  exception when others then
    v_manuscript_version_id := null;
  end;

  perform public.acquire_manuscript_editorial_lock(p_manuscript_id);

  select count(*)::int into v_response_count
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
    manuscript_version_id,
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
    grading_metadata,
    contrary_evidence_gate_status,
    contrary_evidence_gate_version,
    scoring_gate_valid,
    duplicate_deduction_count,
    restored_points_total,
    blocked_stale_deduction_count
  ) values (
    p_manuscript_id,
    v_manuscript_version_id,
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
    p_grading->'grading_metadata',
    nullif(trim(coalesce(p_grading->>'contrary_evidence_gate_status', '')), ''),
    nullif(trim(coalesce(p_grading->>'contrary_evidence_gate_version', '')), ''),
    v_scoring_gate_valid,
    nullif(trim(coalesce(p_grading->>'duplicate_deduction_count', '')), '')::integer,
    nullif(trim(coalesce(p_grading->>'restored_points_total', '')), '')::numeric,
    nullif(trim(coalesce(p_grading->>'blocked_stale_deduction_count', '')), '')::integer
  )
  returning id into v_new_review_id;

  if jsonb_typeof(p_grading->'concern_assessments') = 'array' then
    for v_assessment in select * from jsonb_array_elements(p_grading->'concern_assessments')
    loop
      insert into public.review_concern_assessments (
        review_id,
        prior_review_id,
        manuscript_id,
        manuscript_version_id,
        prior_manuscript_version_id,
        concern_id,
        root_issue,
        source_type,
        rubric_category,
        prior_criticism,
        prior_evidence,
        current_supporting_evidence,
        current_contrary_evidence,
        revision_change,
        original_basis_still_present,
        status,
        confidence,
        prior_deduction,
        points_restored,
        remaining_deduction,
        narrowed_current_finding,
        explanation
      ) values (
        v_new_review_id,
        nullif(trim(coalesce(v_assessment->>'prior_review_id', '')), '')::uuid,
        p_manuscript_id,
        v_manuscript_version_id,
        nullif(trim(coalesce(p_grading->>'prior_manuscript_version_id', '')), '')::uuid,
        coalesce(v_assessment->>'concern_id', 'unknown'),
        coalesce(v_assessment->>'root_issue', 'unknown'),
        coalesce(v_assessment->>'source_type', 'rubric_deduction'),
        nullif(v_assessment->>'rubric_category', ''),
        coalesce(v_assessment->>'prior_criticism', ''),
        coalesce(v_assessment->'prior_evidence', '[]'::jsonb),
        coalesce(v_assessment->'current_supporting_evidence', '[]'::jsonb),
        coalesce(v_assessment->'current_contrary_evidence', '[]'::jsonb),
        v_assessment->'revision_change',
        coalesce((v_assessment->>'original_basis_still_present')::boolean, false),
        coalesce(v_assessment->>'status', 'NOT_ASSESSABLE'),
        coalesce(v_assessment->>'confidence', 'low'),
        coalesce(nullif(v_assessment->>'prior_deduction', '')::numeric, 0),
        coalesce(nullif(v_assessment->>'points_restored', '')::numeric, 0),
        coalesce(nullif(v_assessment->>'remaining_deduction', '')::numeric, 0),
        nullif(v_assessment->>'narrowed_current_finding', ''),
        coalesce(v_assessment->>'explanation', '')
      );
    end loop;
  end if;

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
