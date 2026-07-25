# Expert Calibration Live Provider (PR 3B-2)

Developer runbook for Military Expert live smoke calibration with real Anthropic provider calls.

## Scope

- **Provider:** Anthropic only
- **Model:** `claude-haiku-4-5-20251001` (`haiku-4-5-v1`) — pinned ID only; do not use convenience alias `claude-haiku-4-5` in provider requests
- **Live gate:** smoke subset only — `military_expert_smoke_v1`, `runs=1`, exactly 3 calls
- **No retries, no provider repair, sequential execution**
- **SDK isolated** to `lib/expert-calibration/live/providers/anthropic/invoke.ts`

## Model lifecycle (Haiku 4.5 migration)

| Item | Value |
|------|-------|
| Retired model | `claude-3-5-haiku-20241022` (`haiku-v1`) |
| Retirement date | 2026-02-19 |
| Replacement | `claude-haiku-4-5-20251001` (`haiku-4-5-v1`) |
| Pricing profile | `calibration_anthropic_haiku_4_5_v1` |
| Input rate | $1.00 / million tokens |
| Output rate | $5.00 / million tokens |

**Official sources:** Anthropic model deprecations documentation (`anthropic-model-deprecations`); Anthropic pricing page for Claude Haiku 4.5 (verified 2026-07-25).

Retired models, the old alias `haiku-v1`, and the convenience alias `claude-haiku-4-5` are rejected for new live plans. The historical pricing profile `calibration_anthropic_haiku_v1` ($0.25/M input, $1.25/M output) remains readable for historical replay only.

### Model-lifecycle guard

Version-controlled lifecycle metadata in `lib/expert-calibration/live/model-lifecycle.ts` records provider, model ID, StoryDNA alias, status (`active` / `deprecated` / `retired`), retirement dates, recommended replacement, and pricing profile. Lifecycle is checked before API-key read, session reservation, and provider invocation. No automatic network lookup during execution.

### Historical failed-run preservation

The first paid smoke attempt (session `military-smoke-20260725-v2`, run `.calibration-results/military-smoke-live-20260725-v2-001`) failed with `404 not_found_error` on the retired model. Those artifacts are immutable audit evidence — do not modify, delete, or reconcile them. Do not reuse that session ID or run ID for a new paid run.

### Next step after migration

Run a **fresh preflight dry-run** with `--model haiku-4-5-v1` and revised spending ceilings. Do not immediately execute another paid run or automatically retry the failed session.

## Prerequisites

All five feature flags must be enabled:

| Flag | Purpose |
|------|---------|
| `EXPERT_CALIBRATION_FRAMEWORK_ENABLED` | Calibration framework |
| `EXPERT_CALIBRATION_LIVE_ENABLED` | Live mode |
| `EXPERT_CALIBRATION_ANTHROPIC_ENABLED` | Anthropic provider |
| `EXPERT_MILITARY_GENERATION_CONTRACT_ENABLED` | Generation contract |
| `EXPERT_MILITARY_LIVE_CALIBRATION_ENABLED` | Military Expert live |

Set `ANTHROPIC_API_KEY` in the environment — never pass via CLI flags.

## CLI example (live smoke)

```bash
export EXPERT_CALIBRATION_FRAMEWORK_ENABLED=true
export EXPERT_CALIBRATION_LIVE_ENABLED=true
export EXPERT_CALIBRATION_ANTHROPIC_ENABLED=true
export EXPERT_MILITARY_GENERATION_CONTRACT_ENABLED=true
export EXPERT_MILITARY_LIVE_CALIBRATION_ENABLED=true
export ANTHROPIC_API_KEY=sk-ant-...

npm run calibrate:military -- \
  --mode live \
  --expert military_expert \
  --suite military_expert_v1_draft_golden \
  --subset military_expert_smoke_v1 \
  --provider anthropic \
  --model haiku-4-5-v1 \
  --runs 1 \
  --max-calls 3 \
  --max-total-cost 0.08 \
  --max-cost-per-call 0.03 \
  --session-id my-session-20260725 \
  --session-max-cost 1.00 \
  --ack-token I-ACKNOWLEDGE-LIVE-CALIBRATION-SPEND \
  --output-dir .calibration-results/live-smoke \
  --overwrite true
```

## Rejected CLI flags

These flags are explicitly rejected to prevent credential leakage:

- `--api-key`
- `--anthropic-api-key`
- `--base-url`
- `--endpoint`

## Session budget

- `--session-id` is **required** for live mode
- `--session-max-cost` defaults to `$1.00`
- Per-run `--max-total-cost` defaults to `$0.08` (spending ceiling, not expected cost)
- Per-call `--max-cost-per-call` defaults to `$0.03`
- Three-case smoke estimate at Haiku 4.5 rates (~9,342 input + 7,500 output tokens): approximately **$0.047** worst-case (planner-derived; label as estimate)
- Session state stored atomically at `.calibration-results/sessions/{sessionId}.json`
- Version field enables conflict detection across concurrent runs

## Audit log

Append-only events at `.calibration-results/sessions/{sessionId}.audit.jsonl`:

- `live_run_started` / `live_run_completed` / `live_run_failed`
- `provider_call_started` / `provider_call_completed`
- `session_budget_reserved` / `session_budget_committed` (legacy run-level)
- `session_reservation_created` / `session_reservation_rejected`
- `session_reservation_settled` / `session_reservation_failed`
- `authorization_denied`

## Artifact layout

```
.calibration-results/
  sessions/
    {session-id}.json
    {session-id}.audit.jsonl
  {run-dir}/
    run-manifest.json
    {report_id}.json
    raw-{case_id}-run{index}.json   # when --retain-raw-responses true
```

### Provider API version metadata

Live run manifests and audit events record explicit Anthropic provider metadata under `provider_metadata`:

| Field | Meaning |
|-------|---------|
| `api_version` | Anthropic Messages API version used for the call |
| `sdk_version` | Installed `@anthropic-ai/sdk` package version |
| `response_schema_version` | Military Expert output schema version parsed from the response |
| `pricing_profile_id` | Pinned pricing profile (e.g. `calibration_anthropic_haiku_4_5_v1`) |
| `model_lifecycle_status` | Lifecycle status at plan time (`active`, `deprecated`, `retired`) |
| `model_lifecycle_verified_date` | Date lifecycle metadata was last verified |
| `model_lifecycle_source` | Documentation reference label |
| `recommended_replacement` | Replacement model ID when applicable |

`api_version` is never `null`, empty, or omitted on live runs:

- When deterministically available (SDK default request header or an exposed response value), the exact version string is recorded — currently `2023-06-01` for the bundled SDK default.
- When no deterministic value is available at normalization time, artifacts record the literal `unknown`.
- `unknown` means unavailable, not an inferred provider version.

Dry-run and synthetic manifests do not include `provider_metadata` (zero provider calls).

## Dry-run / synthetic (unchanged)

Dry-run and synthetic modes remain zero provider calls:

```bash
npm run calibrate:military -- --mode dry-run ...
npm run calibrate:military -- --mode synthetic ...
```

## Invariants

| Mode | modelCalls | providerCalls |
|------|------------|---------------|
| dry-run | 0 | 0 |
| synthetic | 0 | 0 |
| live | numeric (≤3 for smoke) | numeric (≤3 for smoke) |

All modes: `productionWrites = 0`, `productionExecutionOccurred = false`.

## Testing

Tests inject a mock `LiveCalibrationProviderInvoker` — no real API calls during `npm test`.

```bash
npm test
npx tsc --noEmit
```
