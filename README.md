# Manuscript Review

A personal, single-user web app for reviewing and revising novel manuscripts.
Next.js (App Router) + Supabase (Postgres + Storage), runnable locally.

> **Two AI providers by design.** This app uses **OpenAI** for the commercial /
> literary-agent perspective and **Anthropic (Claude)** for the craft perspective.
> Each is called through its own official SDK in its own module — they are two
> distinct editorial voices, not interchangeable backends.

## Status

**Phase 1 (foundation) — done:** project structure, full Supabase schema, and the
`.docx` upload → store → text-extraction flow with a manuscript list.

**Phase 2 (dual reviews) — done:** open a manuscript and generate two editorial reviews
side by side — OpenAI (literary-agent / commercial) and Claude (craft). Persisted in the
`reviews` table; regenerate replaces a provider's prior review. Set `OPENAI_API_KEY` and
`ANTHROPIC_API_KEY` in `.env.local` (optionally `OPENAI_MODEL` / `ANTHROPIC_MODEL`).

**Phase 3 (issues checklist) — done:** extract discrete, trackable issues from each review
(tagged by the lens that raised them — OpenAI / Claude), add your own, and toggle each
resolved/outstanding. Persisted in the `issues` table; re-extracting dedupes by title so
resolved state is preserved.

**Phase 4 (fix suggestions) — done:** expand any issue and request concrete fixes from
OpenAI, Claude, or both, grounded in the manuscript text. Suggestions are saved under the
issue (`suggestions` table) and can be deleted.

**Word export (extra) — done:** download the issues checklist and the two reviews as
`.docx` from the manuscript page (`export-issues` / `export-reviews` routes; reviews use a
small Markdown→Word converter). Reviews can also be generated per-provider (OpenAI / Claude
/ Both) to control spend.

**Revision re-check (extra) — done:** upload a revised `.docx` to an existing manuscript
(replaces its text, issues stay attached), then re-check outstanding issues against the new
version with OpenAI or Claude — each issue is judged resolved/outstanding with a note, and
the book gets an updated letter grade. A grade history is kept in the `revision_checks`
table (migration `0002`). Reviews also end with a letter grade.

**Phase 5 (apply edit to .docx) — done:** on any saved suggestion, “Apply this fix to the
.docx” — the suggestion’s model proposes verbatim find→replace edits, you review/tweak and
approve, and the edits are surgically applied to the manuscript’s `.docx` (paragraph-level,
other formatting preserved) and saved as a new version. Download the updated Word doc.
Edits that can’t be located are reported, not silently dropped. (`lib/docx-edit.ts`,
`app/actions/edits.ts`, `download` route.)

**Phase 6 (scene brainstorming) — done:** describe a stuck scene/spot and get distinct
ideas from OpenAI (plot-forward) and Claude (character/theme-forward) side by side; mark a
pick (★) or delete. Optionally ground ideas in the manuscript. (`brainstorms` table.)

All six phases plus extras are complete.

## Setup

### 1. Environment

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The
`OPENAI_API_KEY` / `ANTHROPIC_API_KEY` values aren't needed until Phase 2.

### 2. Supabase

Pick one:

**Local (Docker) —** requires the [Supabase CLI](https://supabase.com/docs/guides/local-development):

```bash
supabase start          # prints your local URL + service_role key for .env.local
supabase db reset       # applies supabase/migrations/0001_init.sql
```

**Cloud —** create a project at supabase.com, then run the contents of
`supabase/migrations/0001_init.sql` in the SQL editor. Copy the project URL and
the `service_role` key (Project Settings → API) into `.env.local`.

### 3. Run

```bash
npm run dev
```

Open http://localhost:3000. If Supabase env vars are missing, the page shows a
setup notice instead of crashing.

## Layout

```
app/
  page.tsx                  # manuscript list + upload
  layout.tsx
  actions/manuscripts.ts    # uploadManuscript server action (validate, extract, store)
  components/UploadForm.tsx  # client upload form
lib/
  supabase/server.ts        # service-role Supabase client (server-only)
  manuscripts.ts            # data access (listManuscripts)
  types.ts                  # DB row types
supabase/
  migrations/0001_init.sql  # full schema + storage bucket
```

## Notes

- **No auth.** Single-user/local; the server uses the Supabase service-role key and
  RLS is intentionally off. Add auth + RLS before this ever leaves localhost.
- Uploaded `.docx` files go to the private `manuscripts` Storage bucket; extracted
  plain text is saved on the row so later AI phases don't re-parse the file.
