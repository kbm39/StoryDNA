---
no_new_capability: true
rationale: Prioritized propagation backlog; items require separate implementation tasks and reviews.
---

# Capability Propagation Backlog

**Created:** 2026-07-31  
**Authority:** Amendment 001 (proposed)  
**Status:** Planning only — **not implementation approval**

## Constitution Compliance

```json
{
  "applicable_sections": ["Amendment 001", "§14"],
  "compliance_explanation": "Backlog derived from retrospective audit; each item still requires its own propagation review.",
  "amendment_required": "No",
  "backward_compatibility_impact": "None until individual items ship.",
  "certification_impact": "Varies per item; see entries."
}
```

---

## Priority Legend

| Priority | Meaning |
|----------|---------|
| **P0** | Constitutional or trust requirement |
| **P1** | Needed before another expert launches |
| **P2** | Improves consistency |
| **P3** | Optional optimization |

---

## P0 — Constitutional or trust requirement

| ID | Capability | Recommended classification | Notes |
|----|------------|---------------------------|-------|
| B-001 | Manuscript evidence | `editorial_board_shared` | Burden of proof foundation |
| B-002 | Burden of proof status | `editorial_board_shared` | Constitution §13 |
| B-003 | Contrary evidence | `editorial_board_shared` | Shared finding contract |
| B-004 | Uncertainty notes | `editorial_board_shared` | ME-only today |
| B-005 | Confidence scoring | `editorial_board_shared` | Unify semantics |
| B-006 | Immutable provenance | `editorial_board_shared` | Definition hashes + review lineage |
| B-007 | Cost accounting | `platform_wide` | Author cost transparency |
| B-008 | Workflow diagnostics | `platform_wide` | Operator + author observability |
| B-009 | Certification metadata | `platform_wide` | Commercial enablement gates |
| B-010 | Author Intent | `platform_wide` | Constitution Phase 1A |
| B-011 | Publication state | `platform_wide` | Constitution Phase 1B |
| B-012 | Series context | `platform_wide` | Constitution Phase 3A |
| B-013 | Author Review Required | `editorial_board_shared` | Unified report integrity |

---

## Amendment 002 — Progressive Editorial Understanding (RATIFIED)

**Authority:** Amendment 002 (RATIFIED, effective 2026-08-01)  
**Status:** Planning only — constitutional rule ratified; runtime enforcement pending per [implementation spec](../implementation/PROGRESSIVE_EDITORIAL_UNDERSTANDING_IMPLEMENTATION_SPEC.md). **Not auto-approved.**

| ID | Capability | Recommended classification | Notes |
|----|------------|---------------------------|-------|
| B-014 | Progressive Editorial Understanding | `platform_wide` | Constitutional quality bar for all author dialogue |
| B-015 | Understanding-confidence model | `platform_wide` | Seven dimensions; five levels; no fake precision |
| B-016 | Conversational advancement quality gate | `platform_wide` | INSUFFICIENT_EDITORIAL_ADVANCEMENT enforcement |
| B-017 | Grounded synthesis | `platform_wide` | Level 3 synthesis with grounding validator |
| B-018 | EIC understanding summary | `editor_in_chief_owned` | Pre-independent-read confirmation composition |
| B-019 | Editorial understanding confirmation | `platform_wide` | Versioned author confirmation gate |
| B-020 | Adaptive clarification | `platform_wide` | Material-clarification rules; max one per stage |
| B-021 | Encouraging-but-honest standard | `editorial_board_shared` | Voice standard for EIC and expert interviews |

**Implementation spec:** [PROGRESSIVE_EDITORIAL_UNDERSTANDING_IMPLEMENTATION_SPEC.md](../implementation/PROGRESSIVE_EDITORIAL_UNDERSTANDING_IMPLEMENTATION_SPEC.md)

---

## Editorial Profile (design complete — EP-0)

**Authority:** [STORYDNA_EDITORIAL_PROFILE_FRAMEWORK.md](../implementation/STORYDNA_EDITORIAL_PROFILE_FRAMEWORK.md)  
**Status:** Planning only — framework design complete; runtime enforcement pending per EP-1+ phases. **Not auto-approved.**

| ID | Capability | Recommended classification | Notes |
|----|------------|---------------------------|-------|
| B-022 | Editorial Profile | `editor_in_chief_owned` | Structured manuscript understanding after independent read |
| B-023 | Profile evidence model | `platform_wide` | Shared locator/evidence vocabulary |
| B-024 | Profile materiality model | `platform_wide` | Editorial significance scale |
| B-025 | Specialist requirement levels | `editor_in_chief_owned` | Domain need assessment — not direct expert recommendation |

**Framework:** [STORYDNA_EDITORIAL_PROFILE_FRAMEWORK.md](../implementation/STORYDNA_EDITORIAL_PROFILE_FRAMEWORK.md)

---

## P1 — Needed before another expert launches

| ID | Capability | Recommended classification | Notes |
|----|------------|---------------------------|-------|
| B-101 | Provisional release | `editorial_board_shared` | Before second expert uses fail-closed path |
| B-102 | Patch-only repair | `expert_family` | JSON-contract experts |
| B-103 | Strict JSON extraction | `expert_family` | Shared provider output handling |
| B-104 | Revision Board integration | `platform_wide` | ME candidates exist but UI blocked |
| B-105 | Full finding prose persistence | `editorial_board_shared` | Export + display parity |
| B-106 | Version delta review | `platform_wide` | Beyond LA gate comparison |
| B-107 | Cross-expert contradiction detection (live) | `editor_in_chief_owned` | Promote audit to EIC workflow |
| B-108 | Expert-domain routing (live) | `editor_in_chief_owned` | Beyond recommend-experts stub |

---

## P2 — Improves consistency

| ID | Capability | Recommended classification | Notes |
|----|------------|---------------------------|-------|
| B-201 | Scene inventory | `expert_family` | Scene-centric experts |
| B-202 | Author scene selection | `expert_family` | Scene-centric experts |
| B-203 | Scene-level review | `expert_family` | Scene-centric experts |
| B-204 | Coverage validation | `expert_family` | Scene-centric experts |
| B-205 | Report exports | `expert_family` | ME docx/md/json today |
| B-206 | Deterministic normalization | `editorial_board_shared` | Engine-wide |

---

## P3 — Optional optimization

| ID | Capability | Notes |
|----|------------|-------|
| B-301 | Unified diagnostics dashboard | Consolidate scattered diagnostics |
| B-302 | Registry-driven capability discovery UI | Operator tooling |

---

## EIC-owned candidates (orchestration)

These must never be implemented as expert judgments:

- Cross-expert contradiction detection
- Duplicate detection / merging
- Domain routing and authoritative ownership
- Unified finding priority
- Capability Propagation Review enforcement

---

## Platform-wide candidates

- Author Intent
- Publication state
- Series context
- Version lineage / delta review
- Cost accounting
- Workflow observability
- Audit logging
- Certification metadata

---

## Backlog rules

1. **No item auto-implements** upon backlog inclusion.
2. Each item requires a completed Capability Propagation Review artifact.
3. Propagation to all experts requires certification benchmark pass where applicable.
4. Founder must ratify Amendment 001 before backlog execution begins.
