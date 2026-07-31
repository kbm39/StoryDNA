---
no_new_capability: true
rationale: Retrospective audit record of existing capabilities; not a new capability proposal.
---

# Retrospective Capability Audit

**Date:** 2026-07-31  
**Audit scope:** Literary Agent, Military Expert V1, Military Expert V2, cross-expert adjudication, revision board, workflow infrastructure  
**Constitution baseline:** v1.0  
**Amendment:** 001 (proposed)

## Constitution Compliance

```json
{
  "applicable_sections": ["§5", "§6", "§14", "Amendment 001"],
  "compliance_explanation": "Retrospective audit required by Amendment 001 retrospective rule.",
  "amendment_required": "No",
  "backward_compatibility_impact": "Read-only audit; no runtime changes.",
  "certification_impact": "Identifies certification dependencies for propagation backlog."
}
```

---

## Executive Summary

Most runtime capabilities originated on **Military Expert V1** and were extended in **Military Expert V2**. **Literary Agent** owns the system-level contrary-evidence gate and revision-comparison path. **Studio/system layers** add cross-expert adjudication, partial EIC routing, revision board mapping, and calibration infrastructure. Constitutional capabilities (Author Intent, publication state, series context, full version-delta expert re-review) remain **governance-only or partial**.

This audit does **not** approve propagation. Each item requires its own Capability Propagation Review before implementation.

---

## Capability Adjudications

### 1. Contrary evidence

| Field | Value |
|-------|-------|
| **Current location** | `lib/contrary-evidence/`, `experts/military-expert/validation.ts`, cross-expert audit |
| **First expert** | Literary Agent (gate); Military Expert (per-finding schema) |
| **Current classification** | Isolated per expert |
| **Recommended classification** | `editorial_board_shared` |
| **Should receive** | All finding-producing experts |
| **Should not receive** | EIC as producer |
| **Gap** | No shared finding contract across experts |
| **Migration** | Shared schema + validation plugin |
| **Certification** | Board-wide benchmark required |
| **Priority** | P0 |

### 2. Uncertainty notes

| Field | Value |
|-------|-------|
| **Current location** | `experts/military-expert/output-schema.ts`, finding content persistence |
| **First expert** | Military Expert |
| **Recommended classification** | `editorial_board_shared` |
| **Should receive** | All finding-producing experts |
| **Should not receive** | Platform orchestration-only layers |
| **Gap** | LA lacks per-finding uncertainty note field |
| **Priority** | P0 |

### 3. Confidence scoring

| Field | Value |
|-------|-------|
| **Current location** | ME contracts, contrary-evidence types, LA grading |
| **First expert** | Literary Agent + Military Expert (multiple layers) |
| **Recommended classification** | `editorial_board_shared` |
| **Should receive** | All finding-producing experts with unified enum |
| **Gap** | Inconsistent confidence semantics across layers |
| **Priority** | P0 |

### 4. Provisional release

| Field | Value |
|-------|-------|
| **Current location** | `experts/military-expert/provisional-release.ts` |
| **First expert** | Military Expert |
| **Recommended classification** | `editorial_board_shared` |
| **Should receive** | All experts after certification |
| **Should not receive** | Automatic without certification |
| **Gap** | ME-only fail-closed path |
| **Priority** | P1 |

### 5. Author Review Required

| Field | Value |
|-------|-------|
| **Current location** | ME contracts, display, scoring exclusion |
| **First expert** | Military Expert |
| **Recommended classification** | `editorial_board_shared` |
| **Should receive** | All finding-producing experts |
| **Gap** | Unified report + constitution §8 pattern not generalized |
| **Priority** | P0 |

### 6. Scene inventory

| Field | Value |
|-------|-------|
| **Current location** | `lib/studio/military-expert-v2/discovery.ts` |
| **First expert** | Military Expert V2 |
| **Recommended classification** | `expert_family` (scene-centric) |
| **Should receive** | Thriller Editor, Character Expert, future scene-centric experts |
| **Should not receive** | Literary Agent, Financial Crimes Expert |
| **Gap** | ME V2 only; studio flag-gated |
| **Priority** | P2 |

### 7. Author scene selection

| Field | Value |
|-------|-------|
| **Current location** | `lib/studio/military-expert-v2/selection-policy.ts` |
| **First expert** | Military Expert V2 |
| **Recommended classification** | `expert_family` |
| **Should receive** | Scene-centric expert family |
| **Priority** | P2 |

### 8. Scene-level review

| Field | Value |
|-------|-------|
| **Current location** | `lib/studio/military-expert-v2/scene-review-*` |
| **First expert** | Military Expert V2 |
| **Recommended classification** | `expert_family` |
| **Should receive** | Scene-centric experts after family contract |
| **Priority** | P2 |

### 9. Patch-only repair

| Field | Value |
|-------|-------|
| **Current location** | `experts/military-expert/contrary-evidence-patch-repair.ts` |
| **First expert** | Military Expert |
| **Recommended classification** | `expert_family` |
| **Should receive** | Experts using strict JSON finding contracts |
| **Priority** | P1 |

### 10. Strict JSON extraction

| Field | Value |
|-------|-------|
| **Current location** | `experts/military-expert/model-json-extraction.ts` |
| **First expert** | Military Expert |
| **Recommended classification** | `expert_family` |
| **Should receive** | JSON-contract experts |
| **Priority** | P1 |

### 11. Cost accounting

| Field | Value |
|-------|-------|
| **Current location** | `lib/expert-calibration/`, workflow budgets, ME draft review |
| **First expert** | System / Military Expert consumer |
| **Recommended classification** | `platform_wide` |
| **Should receive** | All workflows |
| **Gap** | Studio UI mostly placeholder |
| **Priority** | P0 |

### 12. Workflow diagnostics

| Field | Value |
|-------|-------|
| **Current location** | Workflow store, ME parse/provisional diagnostics, progress timeline |
| **First expert** | Literary Agent + Military Expert |
| **Recommended classification** | `platform_wide` |
| **Gap** | No unified diagnostics module |
| **Priority** | P0 |

### 13. Revision Board integration

| Field | Value |
|-------|-------|
| **Current location** | `lib/studio/revision-board.ts`, ME board candidates |
| **First expert** | Literary Agent |
| **Recommended classification** | `platform_wide` |
| **Should receive** | All experts producing board candidates |
| **Gap** | ME explicitly unavailable in UI |
| **Priority** | P1 |

### 14. Full finding prose persistence

| Field | Value |
|-------|-------|
| **Current location** | `lib/studio/military-expert-finding-content.ts` |
| **First expert** | Military Expert |
| **Recommended classification** | `editorial_board_shared` |
| **Should receive** | All finding-producing experts |
| **Priority** | P1 |

### 15. Immutable expert provenance

| Field | Value |
|-------|-------|
| **Current location** | Review provenance, definition hashes, V2 provenance, audit snapshots |
| **First expert** | Literary Agent + Military Expert |
| **Recommended classification** | `editorial_board_shared` |
| **Priority** | P0 |

### 16. Cross-expert contradiction detection

| Field | Value |
|-------|-------|
| **Current location** | `lib/studio/cross-expert-adjudication/detection.ts` |
| **First expert** | System (audit layer) |
| **Recommended classification** | `editor_in_chief_owned` |
| **Gap** | Read-only audit; not live EIC workflow |
| **Priority** | P1 |

### 17. Expert-domain routing

| Field | Value |
|-------|-------|
| **Current location** | `lib/editor-in-chief/recommend-experts.ts`, adjudication domain-assignment |
| **First expert** | Editor-in-Chief (partial) |
| **Recommended classification** | `editor_in_chief_owned` |
| **Gap** | Phase 1 routing only; no execution |
| **Priority** | P1 |

### 18. Publication state

| Field | Value |
|-------|-------|
| **Current location** | Constitution §2 only |
| **Recommended classification** | `platform_wide` |
| **Gap** | No runtime model |
| **Priority** | P0 (constitutional Phase 1B) |

### 19. Series context

| Field | Value |
|-------|-------|
| **Current location** | Constitution §3; `SeriesScope` enum in engine types |
| **Recommended classification** | `platform_wide` |
| **Gap** | No runtime model |
| **Priority** | P0 (constitutional Phase 3A) |

### 20. Version delta review

| Field | Value |
|-------|-------|
| **Current location** | LA contrary-evidence revision comparison; review provenance staleness |
| **Recommended classification** | `platform_wide` |
| **Gap** | Not full expert delta re-review on changed spans |
| **Priority** | P1 |

### 21. Certification benchmark

| Field | Value |
|-------|-------|
| **Current location** | `lib/expert-calibration/`, ME certification harness |
| **Recommended classification** | `platform_wide` |
| **Gap** | Does not yet commercially certify |
| **Priority** | P0 |

---

## Pattern Summary

| Origin | Capabilities |
|--------|--------------|
| Military Expert V1 | contrary evidence (finding-level), uncertainty, confidence, provisional release, author_review_required, patch repair, strict JSON, finding prose |
| Military Expert V2 | scene inventory, selection, scene review, coverage, synthesis repair |
| Literary Agent | contrary-evidence gate, revision board, workflow diagnostics (partial) |
| System / EIC | cross-expert adjudication, domain routing (partial), cost accounting (partial) |
| Constitutional only | Author Intent, publication state, series context |

---

## Next Steps

1. Founder ratification of Amendment 001
2. Execute propagation backlog in priority order with per-item Capability Propagation Reviews
3. No automatic propagation from this audit
