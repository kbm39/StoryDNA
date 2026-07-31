---
no_new_capability: true
rationale: Constitutional amendment document establishing governance process; does not introduce a product runtime capability.
---

# StoryDNA Editorial Constitution Amendment 1

## Capability Propagation Principle

**Amendment ID:** `STORYDNA_CONSTITUTION_AMENDMENT_001`  
**Constitutional version:** 1.1.0 amendment (supplements v1.0)  
**Status:** PROPOSED FOR RATIFICATION  
**Proposed date:** 2026-07-31  
**Supplements:** [StoryDNA Editorial Constitution v1.0](../STORYDNA_EDITORIAL_CONSTITUTION_V1.0.md)

## Constitution Compliance

```json
{
  "applicable_sections": ["§5", "§14", "§18"],
  "compliance_explanation": "Amendment 001 formalizes visible learning and explicit architectural change required by Constitution §5 and §18.",
  "amendment_required": "Yes",
  "backward_compatibility_impact": "Additive governance only; no runtime behavior change until ratified propagation tasks ship.",
  "certification_impact": "Propagation decisions must cite certification impact before reuse."
}
```

---

## Preamble

StoryDNA must not allow capabilities to evolve independently inside isolated experts when those capabilities may belong to the wider editorial organization.

Expert independence protects original findings and domain judgment. It does not authorize silent duplication, silent isolation, or unreviewed platform drift.

---

## Core Rule

**No new capability may be implemented for a single expert until StoryDNA has explicitly evaluated whether the capability belongs to that expert alone, an expert family, the Editorial Board, the Editor-in-Chief, or the platform as a whole.**

Every evaluation must produce a recorded **Capability Propagation Review** using contract `storydna_capability_propagation_review@v1`.

---

## Retrospective Rule

**Existing expert capabilities must also be periodically reviewed to determine whether they should be propagated to current or future experts.**

The initial retrospective audit is recorded in [RETROSPECTIVE_CAPABILITY_AUDIT_2026-07-31.md](../capabilities/RETROSPECTIVE_CAPABILITY_AUDIT_2026-07-31.md).

---

## No Silent Propagation

A capability must not automatically spread to every expert merely because one expert uses it.

Propagation requires:

- domain fit;
- safety review;
- cost review;
- schema compatibility;
- certification impact;
- backward-compatibility review;
- author-experience review.

---

## No Silent Isolation

A capability must not remain isolated merely because it was first built for one expert.

The review must explicitly document why isolation is correct, including an `isolation_reason` when classification is `expert_specific`.

---

## Author Authority

The author must be informed when propagation materially changes:

- available experts;
- report behavior;
- cost;
- runtime;
- confidence;
- revision workflow;
- canon or series handling.

---

## Required Review Questions

Whenever StoryDNA gives one expert a new capability, the review must explicitly answer:

1. Should this capability remain unique to that expert?
2. Should similar experts receive it?
3. Should every expert receive it?
4. Should the Editor-in-Chief own it?
5. Should it become a platform-wide capability?
6. Should existing experts receive it retroactively?
7. Should future experts receive it automatically?

---

## Capability Classifications

| Classification | Meaning |
|----------------|---------|
| `expert_specific` | Used only by one expert because the capability is unique to that domain |
| `expert_family` | Shared across a related class of experts |
| `editorial_board_shared` | Expected across all finding-producing experts |
| `editor_in_chief_owned` | Belongs to orchestration rather than individual experts |
| `platform_wide` | Applies across all StoryDNA workflows and products |

See [classification definitions](../../../lib/governance/capability-propagation/classifications.ts) for owner, implementation location, certification, migration, and default propagation behavior.

---

## Governance Artifacts

| Artifact | Path |
|----------|------|
| Review template | [CAPABILITY_PROPAGATION_REVIEW_TEMPLATE.md](../templates/CAPABILITY_PROPAGATION_REVIEW_TEMPLATE.md) |
| Feature PRD template | [FEATURE_PRD_TEMPLATE.md](../templates/FEATURE_PRD_TEMPLATE.md) |
| Typed contract | `lib/governance/capability-propagation/types.ts` |
| Capability registry | [CAPABILITY_REGISTRY.json](../capabilities/CAPABILITY_REGISTRY.json) |
| Propagation backlog | [CAPABILITY_PROPAGATION_BACKLOG.md](../capabilities/CAPABILITY_PROPAGATION_BACKLOG.md) |
| Conformance check | `npm run governance:capability-check` |

---

## Relationship to Constitution v1.0

This amendment **supplements** the ratified Constitution v1.0. It does not replace or rewrite v1.0.

When ratified, future capability work must satisfy:

- Constitution v1.0 principles; and
- Amendment 001 propagation review requirements.

---

## Ratification (pending)

| Field | Value |
|-------|-------|
| **Amendment** | 001 — Capability Propagation Principle |
| **Status** | PROPOSED FOR RATIFICATION |
| **Ratified by** | *(pending founder ratification)* |
| **Ratification date** | *(pending)* |
