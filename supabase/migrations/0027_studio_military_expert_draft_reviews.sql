-- Kevin Studio · Military Expert draft review persistence (authoritative_result_id UUID handoff).

create table if not exists public.studio_military_expert_draft_reviews (
  id                          uuid primary key default gen_random_uuid(),
  workflow_id                 uuid not null
                              references public.editorial_workflows(id) on delete cascade,
  manuscript_id               uuid not null
                              references public.manuscripts(id) on delete cascade,
  manuscript_version_id       uuid not null,
  parsed_review_hash          text not null,
  request_hash                text null,
  correlation_id              text null,
  review_status               text not null,
  generation_status           text not null,
  provisional_release_used    boolean not null default false,
  author_review_required_count int not null default 0,
  validated_finding_count     int not null default 0,
  expert_version              text not null,
  definition_hash             text not null,
  estimated_cost_usd          numeric(12, 6) null,
  created_at                  timestamptz not null default now(),

  constraint studio_military_expert_draft_reviews_workflow_unique unique (workflow_id)
);

create index if not exists studio_military_expert_draft_reviews_parsed_hash_idx
  on public.studio_military_expert_draft_reviews (parsed_review_hash);

create index if not exists studio_military_expert_draft_reviews_manuscript_idx
  on public.studio_military_expert_draft_reviews (manuscript_id, created_at desc);

create table if not exists public.studio_military_expert_draft_findings (
  id                    uuid primary key default gen_random_uuid(),
  review_id             uuid not null
                        references public.studio_military_expert_draft_reviews(id) on delete cascade,
  finding_index         int not null,
  finding_id            text not null,
  finding_status        text not null,
  category              text not null,
  severity              text not null,
  realism_status        text not null,
  confidence            text not null,
  board_candidate_kind  text null,
  created_at            timestamptz not null default now(),

  constraint studio_military_expert_draft_findings_board_kind_check check (
    board_candidate_kind is null
    or board_candidate_kind in ('revision_candidate', 'investigation_candidate')
  ),
  constraint studio_military_expert_draft_findings_review_index_unique
    unique (review_id, finding_index)
);

create index if not exists studio_military_expert_draft_findings_review_idx
  on public.studio_military_expert_draft_findings (review_id, finding_index);

alter table public.studio_military_expert_draft_reviews enable row level security;
alter table public.studio_military_expert_draft_findings enable row level security;

drop policy if exists studio_military_expert_draft_reviews_select_anon
  on public.studio_military_expert_draft_reviews;
create policy studio_military_expert_draft_reviews_select_anon
  on public.studio_military_expert_draft_reviews
  for select to anon, authenticated using (true);

drop policy if exists studio_military_expert_draft_findings_select_anon
  on public.studio_military_expert_draft_findings;
create policy studio_military_expert_draft_findings_select_anon
  on public.studio_military_expert_draft_findings
  for select to anon, authenticated using (true);

revoke insert, update, delete on public.studio_military_expert_draft_reviews from anon, authenticated;
revoke insert, update, delete on public.studio_military_expert_draft_findings from anon, authenticated;
