-- Literary Agent review versioning: preserve superseded reviews, one active commercial per manuscript.

alter table public.reviews
  add column if not exists lifecycle_status text not null default 'active';

alter table public.reviews drop constraint if exists reviews_lifecycle_status_check;
alter table public.reviews
  add constraint reviews_lifecycle_status_check
  check (lifecycle_status in ('active', 'superseded'));

-- Existing rows become active (safe default above).
update public.reviews
set lifecycle_status = 'active'
where lifecycle_status is null;

-- At most one active Literary Agent (commercial) review per manuscript.
create unique index if not exists reviews_one_active_commercial_per_manuscript
  on public.reviews (manuscript_id)
  where perspective = 'commercial' and lifecycle_status = 'active';

create index if not exists reviews_lifecycle_manuscript_idx
  on public.reviews (manuscript_id, perspective, lifecycle_status);

-- Atomically: supersede prior active commercial review, insert new active review,
-- replace editorial issues + candidates for the new review.
create or replace function public.publish_commercial_review_generation(
  p_manuscript_id uuid,
  p_provider text,
  p_model text,
  p_content text,
  p_metadata jsonb,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_response_count int;
  v_new_review_id uuid;
  v_replace_result jsonb;
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
    lifecycle_status
  ) values (
    p_manuscript_id,
    p_provider,
    'commercial',
    p_model,
    p_content,
    p_metadata,
    'active'
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

revoke all on function public.publish_commercial_review_generation(uuid, text, text, text, jsonb, jsonb) from public;
revoke execute on function public.publish_commercial_review_generation(uuid, text, text, text, jsonb, jsonb) from anon;
revoke execute on function public.publish_commercial_review_generation(uuid, text, text, text, jsonb, jsonb) from authenticated;
grant execute on function public.publish_commercial_review_generation(uuid, text, text, text, jsonb, jsonb) to service_role;
