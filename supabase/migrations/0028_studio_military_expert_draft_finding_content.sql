-- Kevin Studio · Military Expert draft finding author-facing content persistence.

alter table public.studio_military_expert_draft_findings
  add column if not exists finding_content jsonb null;

comment on column public.studio_military_expert_draft_findings.finding_content is
  'Author-facing Military Expert finding prose and evidence captured at persist time.';

create index if not exists studio_military_expert_draft_findings_content_idx
  on public.studio_military_expert_draft_findings (review_id)
  where finding_content is not null;
