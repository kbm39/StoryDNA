# Expert Calibration Live Provider (PR 3B-2)

Developer runbook for Military Expert live smoke calibration with real Anthropic provider calls.

## Scope

- **Provider:** Anthropic only
- **Model:** `claude-3-5-haiku-20241022` (`haiku-v1`)
- **Live gate:** smoke subset only — `military_expert_smoke_v1`, `runs=1`, exactly 3 calls
- **No retries, no provider repair, sequential execution**
- **SDK isolated** to `lib/expert-calibration/live/providers/anthropic/invoke.ts`

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
  --model haiku-v1 \
  --runs 1 \
  --max-calls 3 \
  --max-total-cost 0.05 \
  --max-cost-per-call 0.02 \
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
- Per-run `--max-total-cost` defaults to `$0.05`
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
