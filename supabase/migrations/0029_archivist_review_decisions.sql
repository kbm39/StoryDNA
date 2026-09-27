-- Archivist Phase 1 author-review decisions, evidence/passage grain.
-- Cluster fingerprint groups passages; passage_key is the durable decision identity.
-- passage_key = SHA-256(manuscript_id + version_id + evidence_identity)
-- evidence_identity = locator + SHA-256(normalized excerpt)
-- Does not write accepted canon, Series Bible, or manuscript text.
-- Phase 2 may consume each needs_fix row as its own editorial work item.

create table if not exists public.archivist_review_decisions (
  passage_key              text primary key,
  cluster_fingerprint      text not null,
  evidence_identity        text not null,
  review_state             text not null,
  manuscript_id            uuid not null references public.manuscripts(id) on delete restrict,
  manuscript_version_id    uuid not null references public.manuscript_versions(id) on delete restrict,
  source_workflow_id       uuid null,
  author_identity          text not null default 'author',
  author_comment           text null,
  decided_at               timestamptz not null default now(),
  engine_eligibility       text not null default 'insufficient_semantic_specificity',
  engine_reason            text not null,
  future_consumption       text not null default 'editorial_roadmap_work_item',
  accepted_canon           boolean not null default false,
  series_bible             boolean not null default false,

  constraint archivist_review_decisions_state_check check (
    review_state in ('not_an_issue', 'needs_fix')
  ),
  constraint archivist_review_decisions_eligibility_check check (
    engine_eligibility = 'insufficient_semantic_specificity'
  ),
  constraint archivist_review_decisions_no_canon_check check (
    accepted_canon = false and series_bible = false
  )
);

create index if not exists archivist_review_decisions_manuscript_idx
  on public.archivist_review_decisions (manuscript_id, manuscript_version_id);

create index if not exists archivist_review_decisions_cluster_idx
  on public.archivist_review_decisions (cluster_fingerprint);

create index if not exists archivist_review_decisions_needs_fix_idx
  on public.archivist_review_decisions (manuscript_id, review_state)
  where review_state = 'needs_fix';
