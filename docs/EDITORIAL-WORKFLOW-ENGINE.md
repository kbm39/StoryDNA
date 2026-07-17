# Editorial Workflow Engine

StoryDNA's **Publishing Workflow** system runs long-running editorial work outside blocking browser requests.

## Milestone 1 scope

- **Workflow type:** `literary_agent_review` only
- **Orchestrator:** Trigger.dev (`literary-agent-review` task)
- **Source of truth:** Supabase PostgreSQL (`editorial_workflows`, `editorial_workflow_events`)
- **Feature flag:** `EDITORIAL_WORKFLOW_ENABLED` (default **off**)

## Architecture

1. Browser calls `startLiteraryAgentPublishingWorkflow` (Server Action, &lt;1s).
2. Row inserted in `editorial_workflows` with pinned `manuscript_version_id` + `content_hash`.
3. Trigger.dev task runs `executeLiteraryAgentWorkflow` → existing `runFreshEditorialGeneration` pipeline unchanged except optional phase/cancel hooks.
4. UI observes status via Supabase Realtime + polling + focus reconciliation.
5. Atomic publish still uses `publish_commercial_review_generation` RPC.

## Security limitation (Milestone 1)

The app uses session-cookie middleware (`APP_SESSION_SECRET`), not Supabase Auth per user. Workflow tables use **read-all RLS for Realtime** on anon key. This is acceptable only while StoryDNA remains single-tenant. Multi-user RLS is deferred.

**Never expose** `SUPABASE_SERVICE_ROLE_KEY`, `TRIGGER_SECRET_KEY`, or `ANTHROPIC_API_KEY` to the browser.

## Idempotency

- **Concurrent dedup:** partial unique index on `(manuscript_id, manuscript_version_id, workflow_type)` for active statuses only (`queued`, `preparing`, `running`, `waiting`, `paused`). Completed, failed, and cancelled workflows do not block legitimate reruns.
- **Start nonce:** `idempotency_key` is a new UUID per deliberate start — not reused across completed/failed/cancelled runs.
- **Publish dedup:** task exits early if `authoritative_result_id` is already set.

## Generic workflow metadata (Milestone 1)

Row-level nullable columns support future workflow types without schema redesign:

| Column | M1 example (Literary Agent) |
|---|---|
| `department` | Publishing |
| `owner_type` | platform |
| `owner_label` | StoryDNA |
| `purpose` | Generate Literary Agent review + revision candidates |
| `participating_experts` | `["Literary Agent"]` |
| `next_best_action` | Set on completion |

Append-only `editorial_workflow_events` provides workflow history. No manuscript text or raw model output in event payloads.

## Production sync policy

When `EDITORIAL_WORKFLOW_ENABLED` is off (default), production **never** runs synchronous Literary Agent generation from the browser. The server action `runFreshEditorialGeneration` is blocked in production. CLI and Trigger.dev workers call `lib/editorial-generation/run-fresh-editorial-generation.ts` directly.

Local development may set `EDITORIAL_WORKFLOW_DEV_SYNC_FALLBACK=1` for explicit synchronous testing only.

## Runtime ownership

StoryDNA owns and operates this system in production. Cursor is a development tool only — not a runtime dependency.

## Author-facing phases

No percentages or fake ETAs. Internal phases map to calm labels (see `lib/editorial-workflow/phase-labels.ts`).

## Deferred

See `docs/STORYDNA-ROADMAP.md` — Editorial Workflow Engine section.
