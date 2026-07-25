# Expert Calibration Live Mode (PR 3B-1)

Developer-only infrastructure for controlled Military Expert live calibration.
PR 3B-1 ships dry-run and synthetic modes only — no real provider calls.

## Scope

- Reusable live calibration contracts under `lib/expert-calibration/live/`
- CLI entry: `npm run calibrate:military`
- Operator authorization and feature-flag gates
- Provider/model allowlist (Anthropic Haiku 4.5 only for new plans)
- Budget, timeout, and abort controllers
- Local artifact store under `.calibration-results/`
- Deterministic dry-run and synthetic execution paths
- Static CI/Vercel/Trigger exclusion tests

## Modes

| Mode | Description | Provider calls |
|------|-------------|----------------|
| `dry-run` | Build call plan, estimate cost, write manifest | 0 |
| `synthetic` | Inject deterministic responses through generation contract | 0 |
| `live` | **Rejected in 3B-1** — deferred to PR 3B-2 | 0 |

## CLI example

```bash
npm run calibrate:military -- \
  --mode dry-run \
  --expert military_expert \
  --suite military_expert_v1_draft_golden \
  --subset military_expert_smoke_v1 \
  --provider anthropic \
  --model haiku-4-5-v1 \
  --runs 1 \
  --max-calls 3 \
  --max-total-cost 0.08 \
  --max-cost-per-call 0.03 \
  --max-input-tokens 50000 \
  --max-output-tokens 50000 \
  --timeout-ms 120000 \
  --max-runtime-ms 600000 \
  --output-dir .calibration-results/test-dry-run \
  --overwrite true
```

## Feature flags (all required for live mode in 3B-2)

| Flag | Default |
|------|---------|
| `EXPERT_CALIBRATION_FRAMEWORK_ENABLED` | off |
| `EXPERT_CALIBRATION_LIVE_ENABLED` | off |
| `EXPERT_CALIBRATION_ANTHROPIC_ENABLED` | off |
| `EXPERT_MILITARY_GENERATION_CONTRACT_ENABLED` | off |
| `EXPERT_MILITARY_LIVE_CALIBRATION_ENABLED` | off |

## Subsets

| ID | Cases |
|----|-------|
| `military_expert_smoke_v1` | 3 |
| `military_expert_core_v1` | 12 |
| `military_expert_safety_v1` | 6 |
| `military_expert_ambiguity_v1` | 8 |
| `military_expert_full_v1` | 34 |
| `military_expert_stability_v1` | 5 |

## Invariants

Every execution path maintains:

- `modelCalls = 0`
- `providerCalls = 0`
- `productionWrites = 0`
- `productionExecutionOccurred = false`

## Artifact layout

```
.calibration-results/{run-dir}/
  run-manifest.json
  {report_id}.json        # synthetic mode only
```

Add `.calibration-results/` to `.gitignore` — never commit artifacts.

## PR 3B-2 deferrals

- Real Anthropic invoker
- `--mode live` execution
- Smoke gate paid runs
