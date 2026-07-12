-- Author responses to revision candidates (Editorial Review / Suggested Edits).
-- Records author intent only — does not alter manuscript text.

create table if not exists author_edit_responses (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references revision_candidates(id) on delete cascade,
  manuscript_id uuid not null references manuscripts(id) on delete cascade,
  disposition text not null
    check (disposition in ('accepted', 'rejected', 'modified', 'skipped')),
  author_modified_text text,
  author_note text,
  responded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id)
);

create index if not exists author_edit_responses_manuscript_idx
  on author_edit_responses(manuscript_id);

create index if not exists author_edit_responses_candidate_idx
  on author_edit_responses(candidate_id);

-- Align revision_candidates.status with author dispositions (skipped ≠ rejected).
alter table revision_candidates drop constraint if exists revision_candidates_status_check;
alter table revision_candidates
  add constraint revision_candidates_status_check
  check (status in (
    'proposed',
    'accepted',
    'rejected',
    'modified',
    'skipped',
    'deferred',
    'implemented',
    're_reviewed'
  ));
