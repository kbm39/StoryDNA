-- Revision Engine (Literary Agent V3 · Phase 2): the review's actionable
-- criticisms become trackable Editorial Issues (with success criteria, an
-- owning reviewer, and a resolution status), each linked to concrete, grounded
-- Revision Candidates. Revision phases are declared for the later Workspace.

create table if not exists editorial_issues (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references manuscripts(id) on delete cascade,
  review_id uuid references reviews(id) on delete set null,
  text text not null,
  area text,
  severity text check (severity in ('low', 'medium', 'high')),
  source_section text,
  success_criterion text,
  owning_reviewer text not null default 'Literary Agent',
  resolution_status text not null default 'open'
    check (resolution_status in ('open', 'in_progress', 'resolved', 'verified')),
  verified_at timestamptz,
  verification_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists editorial_issues_manuscript_idx on editorial_issues(manuscript_id);

create table if not exists revision_phases (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references manuscripts(id) on delete cascade,
  name text not null,
  ordinal int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists revision_candidates (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references manuscripts(id) on delete cascade,
  issue_id uuid references editorial_issues(id) on delete cascade,
  phase_id uuid references revision_phases(id) on delete set null,
  type text not null,
  original text not null,
  revised text not null default '',
  locator text,
  word_savings int,
  reason text,
  confidence int,
  confidence_reason text,
  difficulty text,
  story_risk text,
  voice_risk text,
  commercial_impact text,
  reader_impact text,
  grade_delta int,
  consequence_if_unchanged text,
  dependencies text,
  impacts jsonb,
  export_mode text not null default 'track_change',
  verified boolean not null default false,
  status text not null default 'proposed'
    check (status in ('proposed', 'accepted', 'rejected', 'deferred', 'implemented', 're_reviewed')),
  created_at timestamptz not null default now()
);

create index if not exists revision_candidates_manuscript_idx on revision_candidates(manuscript_id);
create index if not exists revision_candidates_issue_idx on revision_candidates(issue_id);
