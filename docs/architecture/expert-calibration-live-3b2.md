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
- Three-case smoke estimate at Haiku 4.5 rates (planner-derived from prompt tokenization; label as estimate): approximately **$0.0489** expected, **$0.0729** authorized worst-case for three calls at default 4096 output-token cap
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

### Haiku 4.5 smoke v2 budget regression (2026-07-25)

The second paid Haiku 4.5 smoke run (session `military-smoke-haiku45-20260725-v2`, run `cal-ms0tbw2n-rbso0j`) succeeded at the provider layer for call 1 but stopped with `budget_exhausted` before call 2. Dollar budget was not exhausted (~$0.014 of $0.08). Those artifacts are immutable — do not modify, delete, or reuse that session ID or run ID.

**Root cause:** `--max-output-tokens` was conflated with both the Anthropic per-call `max_tokens` cap and the cumulative run output-token ceiling. After call 1 used 2175 output tokens, call 2 was blocked because `2175 + 4096 > 4096`.

**Token budget model (`live_calibration_token_budget@v2`):**

| Concept | CLI / source | Smoke default |
|---------|--------------|---------------|
| Provider per-call max output tokens | `--max-output-tokens` | 4096 |
| Cumulative run output-token ceiling | `--max-run-output-tokens` (optional) | Derived: 4096 × 3 = 12288 |
| Cumulative run input-token ceiling | `--max-input-tokens` | 50000 |
| Max calls | `--max-calls` | 3 |

When `--max-run-output-tokens` is omitted, the cumulative ceiling is derived deterministically as `providerMaxOutputTokensPerCall × maxCalls`, subject to dollar-budget authorization at plan time. Both values are recorded in manifests and audit logs.

**Dollar authorization (unchanged):**

| Gate | Limit |
|------|-------|
| Per-call authorized worst-case | $0.03 |
| Run authorized worst-case | $0.08 |
| Session ceiling | $1.00 |

Reservation uses authorized worst-case dollar cost; settlement uses actual usage-derived cost. Token telemetry and dollar accounting remain separate.

**Output contract v2 clarifications:**

- `manuscript_evidence[]` items must be objects `{ excerpt, locator?, verification_note? }` — strings are invalid.
- Negative findings require at least one valid evidence object plus contrary-evidence handling via `contrary_evidence[]` or an explicit no-contrary statement in `uncertainty_note`.
- `category_assessments[].status` must be one of: `strong | credible | mixed | weak | insufficient_evidence | not_applicable` — empty string and synonyms are invalid.
- Summary must acknowledge material strengths; material concerns are required only when negative findings exist (true-negative summaries must not fabricate concerns).
- Normalization audit records (`moderate→medium`, `medium→moderate`) persist in contract metadata.

**Next paid smoke:** Use a **new** session ID and run ID. Do not retry `military-smoke-haiku45-20260725-v2` or `cal-ms0tbw2n-rbso0j`.

### Haiku 4.5 smoke output-contract remediation (2026-07-25)

The first paid Haiku 4.5 smoke run (session `military-smoke-haiku45-20260725-v1`, run `cal-ms0samur-3nmhun`) succeeded at the provider layer but failed calibration parsing (0/3). Those artifacts are immutable — do not modify, delete, or reuse that session ID or run ID.

**Authoritative output contract:** `experts/military-expert/output-schema.ts` (`military_expert_output@v1-draft`).

| Policy | Value |
|--------|-------|
| Required top-level fields | `summary`, `strengths`, `findings`, `category_assessments`, `overall_realism_assessment`, `critical_issues`, `priority_actions`, `verification_requests`, `escalation_recommendations`, `uncertainty_summary`, `next_step`, `author_challenge_supported` |
| Prohibited extra top-level fields | `author_challenge_note`, `closing_note`, `author_notes`, `review_notes`, `metadata` |
| Confidence enum | `high`, `medium`, `low` |
| Severity enum | `critical`, `major`, `moderate`, `minor`, `informational` |
| Recommendation type enum | `correct`, `clarify`, `narrow`, `verify`, `preserve`, `escalate`, `no_change` |
| True-negative shape | `findings: []` with non-empty `summary`, `strengths`, and `next_step` |

**Schema-alignment strategy:** Prompts embed one canonical contract block (`militaryExpertOutputSchemaPromptBlock`). Parser and validator remain mandatory downstream gates — the schema is not loosened for arbitrary model output.

**Structured output decision:** The installed `@anthropic-ai/sdk` exposes `output_config.format` with `json_schema`, but the Military Expert contract includes conditional rules beyond JSON Schema. Native structured output was **not adopted** for this remediation; rely on prompt-contract enforcement plus existing parser/validator gates.

**Deterministic normalization (`military_expert_enum_normalization@v1`):** Only exact aliases: confidence `moderate→medium`, severity `medium→moderate`. Reject `context_clarification`, `context_required`, and all other unknown enums. Original values are preserved in normalization audit metadata during parse.

**Expected vs authorized cost:**

| Metric | Source | Smoke example |
|--------|--------|---------------|
| Expected cost | Calibrated token estimate from prompts (~3824 input + 2500 output per case) | ~$0.0489 run total |
| Authorized worst-case | Pricing-derived bound using provider `max_tokens` cap | ~$0.0729 run total (3 × ~$0.0243) |
| Provider output cap | `live_calibration_output_tokens@v1` (4096 default) | Fits $0.03/call and $0.08/run at Haiku 4.5 rates |

Reservation uses authorized worst-case; settlement uses actual usage. Over-budget token configuration fails at plan time before any provider invocation.

**Next paid smoke:** Use a **new** session ID and run ID. Do not retry `military-smoke-haiku45-20260725-v1` or `cal-ms0samur-3nmhun`.

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
