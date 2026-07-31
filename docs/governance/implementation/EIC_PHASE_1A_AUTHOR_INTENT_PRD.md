# Feature PRD — EIC Phase 1A: Author Intent & EIC Plan Gate

## Summary

- **Feature name:** EIC Phase 1A — Author Intent & EIC Plan Gate
- **Owner:** Kevin Track / StoryDNA Editorial Organization
- **Target phase:** Phase 1A (Constitutional roadmap)
- **Constitution baseline:** v1.0 + Amendment 001 (RATIFIED)

---

## Constitution Compliance

```json
{
  "applicable_sections": ["§1", "§6", "§10", "§12", "§13", "§14"],
  "compliance_explanation": "Phase 1A implements Constitution §1 Author Intent as an explicit author-originated record above the Editor-in-Chief. The EIC plan gate (§10) blocks editorial planning without valid intent. Expert governance (§6) is preserved: no expert is launched, no provider is called, no commercial enablement occurs. Constitutional rights (§12) and burden of proof (§13) are respected through immutable history and honest expert availability. Conformance tests (§14) are included in the test plan.",
  "amendment_required": "No",
  "backward_compatibility_impact": "Additive only. Legacy Literary Agent and Military Expert direct-launch paths remain when feature flags are off. StoryDNA-derived author intent display on manuscript pages is unchanged.",
  "certification_impact": "No expert is commercially enabled. Author Intent and EIC plan gate are private Studio features behind flags defaulting off in production."
}
```

---

## Capability Propagation Review

```json
{
  "new_capability_introduced": "Author Intent record (storydna_author_intent@v1)",
  "existing_capability_modified": "StoryDNA-derived AuthorIntent prompt block (legacy bridge only)",
  "classification": "platform_wide",
  "existing_experts_evaluated": ["literary_agent", "military_expert", "developmental_editor", "editor_in_chief"],
  "future_experts_affected": ["continuity_expert", "timeline_expert", "archivist", "combat_medicine_expert", "financial_crimes_expert"],
  "editor_in_chief_impact": "EIC requires Author Intent as mandatory input before any editorial plan is generated.",
  "platform_impact": "New persistence layer, Studio UI, and workflow gate integration points. All future experts consume intent for recruitment weighting.",
  "certification_impact": "No commercial certification change. Intent record is author-controlled configuration, not expert judgment.",
  "propagation_decision": "move_to_platform",
  "review_artifact_path": "docs/governance/implementation/EIC_PHASE_1A_AUTHOR_INTENT_PRD.md"
}
```

---

## EIC Plan Gate Capability Propagation Review

```json
{
  "new_capability_introduced": "EIC editorial plan gate (storydna_eic_editorial_plan@v1)",
  "existing_capability_modified": "none",
  "classification": "editor_in_chief_owned",
  "existing_experts_evaluated": ["literary_agent", "military_expert", "editor_in_chief"],
  "future_experts_affected": ["continuity_expert", "timeline_expert", "archivist", "developmental_editor"],
  "editor_in_chief_impact": "Primary owner. Plan gate produces deterministic expert recommendations without launching providers or workflows.",
  "platform_impact": "Gate blocks expert launch when intent is missing or invalid. Does not alter historical reports or manuscripts.",
  "certification_impact": "Plan gate is orchestration only. Experimental and unavailable experts are shown honestly; no silent expert selection.",
  "propagation_decision": "move_to_editor_in_chief",
  "review_artifact_path": "docs/governance/implementation/EIC_PHASE_1A_AUTHOR_INTENT_PRD.md"
}
```

---

## Problem

StoryDNA has no constitutional Author Intent record. Experts can be recruited and launched without the author explicitly declaring what they are trying to accomplish. The Editor-in-Chief exists only as a registry seed with no runtime plan gate.

## Goals

1. Persist explicit, author-originated Author Intent records per manuscript version.
2. Provide a private Studio UI for intent selection, activation, history, and supersession.
3. Generate deterministic EIC editorial plans from intent without calling providers.
4. Gate expert launch paths when flags are enabled and intent is missing or invalid.
5. Preserve immutable intent history with supersession linkage.

## Non-goals

- Phase 1B (expert auto-launch, provider calls, commercial enablement).
- Altering historical reports or manuscripts.
- Replacing StoryDNA-derived intent display (legacy bridge remains).
- Removing legacy direct-launch bypass paths.

## User Experience

### Author Intent Studio route

`/studio/books/[bookId]/intent` — "What are you trying to accomplish?"

Authors can:
- Choose one primary intent type from the supported enum.
- Describe success in their own words.
- Select priority domains.
- Request or decline specific experts.
- Activate the intent (creates immutable active record).
- View recommended editorial team from deterministic EIC plan.
- View intent history.
- Supersede the current intent (creates new record; prior marked superseded).

Required copy:
> "StoryDNA uses your goal to recommend the right editorial team. No expert will be launched from this plan without your confirmation."

Experimental and unavailable experts are shown honestly. No paid or expert workflow is preselected or launched.

## Domain Model

### Contract: `storydna_author_intent@v1`

| Field | Type | Notes |
|-------|------|-------|
| `contract_version` | string | Always `storydna_author_intent@v1` |
| `manuscript_id` | uuid | Book identity |
| `manuscript_version_id` | uuid | Edition scope |
| `intent_type` | enum | See supported types below |
| `custom_objective_text` | string? | Required when `intent_type = custom` |
| `author_success_definition` | string | Author's definition of success |
| `requested_experts` | string[] | Must not overlap declined |
| `declined_experts` | string[] | Must not overlap requested |
| `priority_domains` | string[] | Optional domain emphasis |
| `budget_preference` | string? | Author preference |
| `time_preference` | string? | Author preference |
| `status` | enum | `draft`, `active`, `superseded`, `cancelled` |
| `created_by` | string | Author identifier |
| `supersedes_intent_id` | uuid? | Prior intent linkage |
| `superseded_by_id` | uuid? | Successor intent linkage |
| `activated_at` | timestamp? | When status became active |

### Contract: `storydna_eic_editorial_plan@v1`

| Field | Type | Notes |
|-------|------|-------|
| `contract_version` | string | Always `storydna_eic_editorial_plan@v1` |
| `author_intent_id` | uuid | Source intent |
| `required_experts` | ExpertPlanEntry[] | Must-run experts |
| `recommended_experts` | ExpertPlanEntry[] | Suggested experts |
| `optional_experts` | ExpertPlanEntry[] | Optional coverage |
| `declined_experts` | ExpertPlanEntry[] | Author-declined |
| `unavailable_experts` | ExpertPlanEntry[] | Not yet built |
| `experimental_experts` | ExpertPlanEntry[] | Private/experimental |
| `blocked_experts` | ExpertPlanEntry[] | Policy-blocked |
| `recommendation_reasons` | Record<string, string> | Per-expert rationale |
| `estimated_cost_range` | string? | Honest estimate |
| `estimated_runtime_range` | string? | Honest estimate |
| `domain_coverage` | string[] | Covered domains |
| `series_context` | string? | Series/standalone note |
| `publication_context` | string? | Publication state note |
| `status` | enum | Plan lifecycle status |

### Supported intent types

`general_manuscript_review`, `query_preparation`, `traditional_publishing`, `self_publishing`, `kindle_unlimited`, `screenplay_adaptation`, `television_adaptation`, `comic_adaptation`, `developmental_editing`, `copy_editing`, `military_realism`, `medical_realism`, `financial_realism`, `continuity_review`, `word_count_reduction`, `series_consistency`, `certification_benchmark`, `custom`

## Persistence

Migration `0032_author_intent_eic_plan.sql`:
- `author_intent_records` table with immutable history
- `eic_editorial_plans` table with plan JSONB
- Partial unique index: one active intent per `(manuscript_id, manuscript_version_id)`
- Composite FK ensuring version belongs to manuscript
- **Not applied to Supabase during this task**

## Plan-Gate Rules

The gate blocks when:
- Author Intent is missing or invalid
- Manuscript version does not match intent
- Expert key is unknown
- Requested expert is unavailable
- Conflicting active plan exists for same intent

The gate never launches providers or workflows.

## Feature Flags

| Flag | Default | Production |
|------|---------|------------|
| `STUDIO_AUTHOR_INTENT_ENABLED` | off | unavailable |
| `STUDIO_EIC_ENABLED` | off | unavailable |

When flags are off, legacy behavior is preserved.

## Backward Compatibility

- Literary Agent workflows unchanged when flags off.
- Military Expert V1 and V2 workflows unchanged when flags off.
- Historical reports and current report routes unchanged.
- Legacy direct-launch bypass documented in `lib/eic/legacy-bypass.ts`.
- StoryDNA-derived `AuthorIntent` prompt block remains for existing review generation.

## Tests

- Every intent type validation
- Custom-text requirement
- Requested/declined conflict rejection
- Unknown expert rejection
- Active-intent uniqueness
- Supersession history
- Author ownership
- Version mismatch gate
- Missing-intent gate
- Unavailable and experimental expert treatment
- Deterministic recommendations
- No provider call (source scan)
- No workflow launch (source scan)
- UI server action coverage
- Feature flags off preserve behavior
- Literary Agent and Military Expert regression guards
- Migration 0032 conformance
- Governance capability-check pass

## Acceptance Criteria

1. Author can create, activate, view, and supersede intent in Studio when flags enabled.
2. EIC plan is generated deterministically from active intent.
3. Plan gate blocks launch paths when intent missing (flags on).
4. No provider calls or expert workflow launches from plan gate.
5. Intent history is immutable; supersession preserves linkage.
6. `npm run governance:capability-check` passes on this PRD.
7. All Phase 1A focused tests pass.
8. Constitution and Amendment 001 remain unchanged.

## Rollout / Certification Gates

- Private Studio only (`STUDIO_AUTHOR_INTENT_ENABLED`, `STUDIO_EIC_ENABLED`).
- Defaults off; production unavailable until explicit enablement.
- Phase 1B requires separate PRD and capability reviews.
