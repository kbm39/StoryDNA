-- "Older versions" area on the library: manuscripts the user has dragged below
-- the line (e.g. superseded same-named uploads) are marked archived so they
-- don't get mixed up with the current ones. Purely an organizational flag.
alter table manuscripts add column if not exists archived boolean not null default false;

create index if not exists manuscripts_archived_idx on manuscripts(archived);
