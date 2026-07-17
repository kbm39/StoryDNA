# Editorial Workflow Engine — Milestone 1 Runbook

## Local development

### Prerequisites

- Supabase local or remote dev project with migration `0023` applied
- Trigger.dev account + dev project
- `.env.local` configured (see below)

### Terminals

```bash
# Terminal A — Next.js
npm run dev

# Terminal B — Trigger.dev dev worker
npx trigger.dev@latest dev
```

### Apply migration (local)

```bash
# Using your existing Supabase workflow — do not apply to production without approval
supabase db push
# or run SQL from supabase/migrations/0023_editorial_workflows.sql manually
```

### Enable locally

```env
EDITORIAL_WORKFLOW_ENABLED=1
TRIGGER_SECRET_KEY=tr_dev_...
TRIGGER_PROJECT_ID=proj_...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY also on Trigger.dev dev env

# Optional: explicit local synchronous fallback (never production):
# EDITORIAL_WORKFLOW_DEV_SYNC_FALLBACK=1
```

When the flag is off, the manuscript page shows a calm unavailable message and **does not** call synchronous Literary Agent generation.

### Smoke test

1. Open a manuscript page.
2. Click **Run Literary Agent Review**.
3. Confirm immediate Publishing Workflow card (no long blocking spinner).
4. Reload page — card persists.
5. Double-click start — same workflow id returned.
6. Wait for completion — review appears; page refreshes.

### CLI regression (no workflow)

```bash
node --env-file=.env.local --experimental-strip-types scripts/run-literary-agent-review.mjs [manuscriptId]
```

## Production setup (after founder approval)

1. Apply `0023` migration to production Supabase.
2. Create Trigger.dev **production** project environment.
3. Set Trigger.dev secrets: `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, etc.
4. Deploy Trigger tasks: `npx trigger.dev@latest deploy`.
5. Set Vercel env: `EDITORIAL_WORKFLOW_ENABLED=0` initially, `TRIGGER_SECRET_KEY`, `TRIGGER_PROJECT_ID`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
6. Deploy Next.js app to Vercel (Trigger tasks deploy separately via CLI — not bundled into the Next build).
7. Staging: set `EDITORIAL_WORKFLOW_ENABLED=1`, run Hold Fast-scale test.
8. Production: enable flag when validated.

## Rollback

| Action | Effect |
|---|---|
| `EDITORIAL_WORKFLOW_ENABLED=0` | LA unavailable in UI; no new workflows |
| Pause task in Trigger.dev | No new task runs |
| Revert app deploy | Prior UI; workflow rows inert |

Do **not** drop workflow tables in rollback.

## Retention

- Completed workflows: retained
- Failed workflows: 90 days (cleanup job deferred)
- Diagnostics storage keys: 30 days TTL (cleanup deferred)
- Events: retained; no manuscript text in payloads
