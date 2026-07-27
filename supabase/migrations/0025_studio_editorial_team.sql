-- Kevin Track · Studio editorial team membership (owner-scoped, not commercial).

create table if not exists public.studio_editorial_team_members (
  manuscript_id uuid not null references public.manuscripts(id) on delete cascade,
  expert_key      text not null,
  owner_notes     text null,
  recruited_at    timestamptz not null default now(),
  primary key (manuscript_id, expert_key)
);

create index if not exists studio_editorial_team_manuscript_idx
  on public.studio_editorial_team_members (manuscript_id);
