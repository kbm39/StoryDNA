# Military Expert V2 — Phase 2A

Phase 2A implements **selected-scene provider reviews** from a confirmed immutable selection snapshot through per-scene validation, repair, persistence, coverage validation, and a private inspection screen. It does **not** run cross-scene synthesis, final V2 findings, or a V2 author report.

## Feature flags

Both flags must be enabled in local Kevin Studio development:

```bash
STUDIO_MILITARY_EXPERT_ENABLED=1
MILITARY_EXPERT_V2_SCENE_CENTRIC=1
```

## Flow (Phase 2A)

```
confirmed immutable snapshot
  → handoff validation
  → per-scene provider review (Haiku 4.5)
  → per-scene validation + repair
  → persistence
  → coverage validation (100% terminal)
  → private inspection screen
  → STOP
```

## Contracts

- `military_expert_scene_review@v1` — per-scene review payload
- Reuses Phase 1 inventory/selection contracts unchanged

## Workflow

- Workflow type: `military_expert_v2_scene_review`
- Definition version: `military_expert_v2_scene_review@v1`
- Trigger task: `military-expert-v2-scene-review`
- Phases: `preparing` → `reviewing_scenes` → `repairing_scenes` → `validating_coverage` → `completed`
- Bounded concurrency: max 3 simultaneous scene calls

## Inspection route

`/studio/books/[bookId]/experts/military-expert/scene-reviews/[snapshotId]`

Private calibration screen — not the final author report.

## Budget

- Profile: `STUDIO_MILITARY_V2_SCENE_REVIEW_BUDGET_USD` ($5.00 ceiling)
- Model: `claude-haiku-4-5-20251001` (Anthropic Haiku 4.5)
- Repair reserve per scene included before launch

## Database (migration 0030)

- `studio_military_expert_scene_reviews`
- `studio_military_expert_scene_review_repairs`
- `studio_military_expert_scene_review_coverage`

## Terminal review statuses (Author Mode)

- `complete`
- `insufficient_evidence`
- `outside_expertise`

Coverage gate requires 100% terminal coverage with zero `failed` scenes.

## Preserved V1 path

Unchanged when V2 flag off:

- `execute-military-expert-studio-workflow.ts`
- V1 report contract and `finding_content` tables
- V1 report routes and exports

## Next step (Phase 2B)

Cross-scene synthesis from persisted scene reviews into V2 findings and author report scope disclosure — without replacing V1 plumbing.
