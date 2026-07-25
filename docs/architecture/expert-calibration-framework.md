# Expert Calibration Framework

StoryDNA PR 3A — reusable expert calibration (test/replay only).

## Purpose

Measure expert review quality against golden expectations using deterministic
matching, metrics, stability analysis, and certification-readiness thresholds.
Military Expert is the first consumer; shared contracts remain expert-agnostic.

## Architecture

- `lib/expert-calibration/` — shared contracts, validation, scoring, metrics, runner
- `experts/{expert}/calibration/` — expert adapter, corpus, thresholds

## Formulas

- **precision** = TP / (TP + FP); **recall** = TP / (TP + FN)
- **hallucination_rate** = FP / (TP + FP)
- **missed_finding_rate** = FN / (TP + FN)
- Division by zero returns 0 (never NaN/Infinity)

## Automatic vs human metrics

Automatic: enum/category match, evidence presence, regex patterns, stability hashes.
Human-required: `match_mode: human_required`, hybrid adjudication cases.
Editorial quality scores remain `null` until human adjudication records supplied.

## Fixture rules

- Synthetic excerpts only in PR 3A
- Bounded excerpt length (5000 chars)
- Unique case IDs, immutable golden expectations
- Provenance must be `synthetic` with `approval_status: approved`

## Replay-only limitation

PR 3A performs **no live model execution**. The runner consumes caller-supplied
synthetic replay outputs only. Live calibration is deferred to PR 3B
(`scripts/expert-calibration/`).

## Privacy controls

- No full manuscript text in aggregate reports
- Failure messages truncated to 200 chars
- No API keys or credentials in fixtures

## Feature flag

`EXPERT_CALIBRATION_FRAMEWORK_ENABLED` — default off. Tests bypass via
`bypassFeatureFlag: true`.

## Future experts

Implement `ExpertCalibrationAdapter` in `experts/{key}/calibration/adapter.ts`
with finding projection and validation. Register corpus and thresholds per expert.
