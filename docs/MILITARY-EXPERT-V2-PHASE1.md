# Military Expert V2 — Phase 1

Phase 1 implements **inventory-only discovery**, persistence, author scene selection, and immutable confirmation. It does **not** run selected-scene military reviews, synthesize findings, or generate a V2 final report.

## Feature flags

Both flags must be enabled in local Kevin Studio development:

```bash
STUDIO_MILITARY_EXPERT_ENABLED=1
MILITARY_EXPERT_V2_SCENE_CENTRIC=1
```

- `MILITARY_EXPERT_V2_SCENE_CENTRIC` defaults **off**
- Never enabled in **production**
- V2 paths require `isStudioMilitaryExpertLocalOverrideEnabled()` **and** `isMilitaryExpertV2SceneCentricEnabled()`

When V2 flag is off, **V1 Military Expert behavior is unchanged**.

## Flow (Phase 1)

```
manuscript → deterministic scene discovery → validate → persist inventory
  → author selection UI → immutable confirmation → STOP
```

## Contracts

- `military_expert_scene_inventory@v1`
- `military_expert_v2_handoff@v1` (defined for Phase 2; not emitted at confirm in Phase 1)

## Workflow

- Workflow type: `military_expert_v2_inventory`
- Definition version: `military_expert_v2_inventory@v1`
- Trigger task: `military-expert-v2-inventory`
- Completes with `ready_for_selection` — no findings, no review UUID

## Author selection route

`/studio/books/[bookId]/experts/military-expert/inventory/[inventoryId]`

Launch from Expert Desk via **Discover Scenes (V2)** when flags are on.

## Author Mode vs Certification Mode

| Mode | Default selection | Deselect major |
|------|-------------------|----------------|
| Author | Major selected; moderate/minor unselected | Allowed with warning |
| Certification | Major + required moderate selected | Blocked for major |

## Locator rules

Display precedence: exact page → approximate page (prefixed `approx.`) → chapter/scene heading → `% through book`. Internal char offsets are never shown as primary locators.

## Cost estimation

Versioned estimator: `military_expert_v2_estimator@v1`. Separate budget from V1 `STUDIO_MILITARY_BUDGET` — V2 selection uses `STUDIO_MILITARY_V2_SELECTION_BUDGET_USD` ($5.00 private studio ceiling). Confirmation disabled when estimate exceeds budget.

## Confirmation immutability

Confirmed snapshots are stored in `studio_military_expert_selection_snapshots` with `immutable = true`. One confirmed snapshot per inventory. Selection edits blocked after confirm.

Phase 1 completion message:

> Your Military Expert scene inventory and review scope are saved. Detailed scene review is not enabled in this build yet.

## Database (migration 0029)

- `studio_military_expert_scene_inventories`
- `studio_military_expert_scene_inventory_entries`
- `studio_military_expert_scene_selections`
- `studio_military_expert_selection_snapshots`

## Known limitations

- Deterministic discovery only — **no provider refinement** in Phase 1
- No page map — locators use chapter labels and approximate percentages
- No scene-level review, synthesis, or V2 report
- Hold Fast calibration uses synthetic fixture in tests; live DB calibration requires local manuscript access

## Preserved V1 path

Unchanged when V2 flag off:

- `execute-military-expert-studio-workflow.ts`
- V1 prompts and generation contract
- Report routes and exports
- `finding_content` persistence

## Next step (Phase 2)

Implement selected-scene provider review using immutable `MilitaryExpertV2ReviewHandoffPayload`, then synthesis and V2 report scope disclosure — without replacing V1 plumbing.
