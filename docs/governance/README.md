---
no_new_capability: true
rationale: Governance index; does not introduce a product runtime capability.
---

# StoryDNA Governance

## Constitution Compliance

```json
{
  "applicable_sections": ["§14", "Amendment 001"],
  "compliance_explanation": "Index document for governance artifacts.",
  "amendment_required": "No",
  "backward_compatibility_impact": "none",
  "certification_impact": "none"
}
```

This directory holds the highest-level architectural authority for StoryDNA editorial operations.

## Constitutional documents

| Document | Version | Status |
|----------|---------|--------|
| [StoryDNA Editorial Constitution v1.0](./STORYDNA_EDITORIAL_CONSTITUTION_V1.0.md) | 1.0 | **RATIFIED** (2026-07-31) |
| [Amendment 001 — Capability Propagation Principle](./amendments/STORYDNA_CONSTITUTION_AMENDMENT_001_CAPABILITY_PROPAGATION.md) | 1.1.0 amendment | **RATIFIED** (effective 2026-07-31) |
| [Amendment 002 — Progressive Editorial Understanding](./amendments/STORYDNA_CONSTITUTION_AMENDMENT_002_PROGRESSIVE_EDITORIAL_UNDERSTANDING.md) | 1.2.0 amendment | **RATIFIED** (effective 2026-08-01) |

**Version relationship:** Constitution v1.0 remains the ratified base document. Amendment 001 **supplements** v1.0 and does not replace it. Amendment 002 **supplements** v1.0 + Amendment 001 and does not replace either document. Effective governance is **v1.0 + Amendment 001 + Amendment 002**.

**Permanent tag (Constitution v1.0 only):** `storydna-editorial-constitution-v1.0` → ratification commit `c24851c518e2d06e8288c3ecc4e67157b512895e`

## Ratified constitutional requirement — Amendment 001

Amendment 001 is **mandatory** for all future capability proposals. Before any new or materially modified expert or platform capability ships:

1. Complete a [Capability Propagation Review](./templates/CAPABILITY_PROPAGATION_REVIEW_TEMPLATE.md) using contract `storydna_capability_propagation_review@v1`.
2. Classify the capability per Amendment 001.
3. Answer all seven propagation questions.
4. Record the capability in [CAPABILITY_REGISTRY.json](./capabilities/CAPABILITY_REGISTRY.json).
5. Include Constitution Compliance and Capability Propagation Review blocks in the feature PRD.
6. Run `npm run governance:capability-check` before commit.

**Ratification does not authorize automatic propagation.** The [propagation backlog](./capabilities/CAPABILITY_PROPAGATION_BACKLOG.md) is planning only. Each item still requires:

- its own Constitution Compliance block;
- a completed Capability Propagation Review;
- a dedicated implementation task;
- focused tests;
- certification impact review.

## Ratified constitutional requirement — Amendment 002

Amendment 002 is **mandatory** for all future conversational features. It establishes the **Progressive Editorial Understanding Principle**: every StoryDNA author interaction must leave the editorial relationship with meaningfully deeper, evidence-grounded understanding. Merely collecting, repeating, or lightly paraphrasing an answer is not sufficient.

- Amendment document: [STORYDNA_CONSTITUTION_AMENDMENT_002_PROGRESSIVE_EDITORIAL_UNDERSTANDING.md](./amendments/STORYDNA_CONSTITUTION_AMENDMENT_002_PROGRESSIVE_EDITORIAL_UNDERSTANDING.md)
- Implementation spec: [PROGRESSIVE_EDITORIAL_UNDERSTANDING_IMPLEMENTATION_SPEC.md](./implementation/PROGRESSIVE_EDITORIAL_UNDERSTANDING_IMPLEMENTATION_SPEC.md)
- Capability review: [AMENDMENT_002_CAPABILITY_PROPAGATION_REVIEW.md](./capabilities/AMENDMENT_002_CAPABILITY_PROPAGATION_REVIEW.md)

**Constitutional rule is ratified; runtime enforcement is pending.** Ratification does not authorize automatic implementation. The approved [implementation specification](./implementation/PROGRESSIVE_EDITORIAL_UNDERSTANDING_IMPLEMENTATION_SPEC.md) must be executed in dedicated implementation tasks. The [propagation backlog](./capabilities/CAPABILITY_PROPAGATION_BACKLOG.md) remains **unimplemented** and is not auto-approved.

## Approved governance mechanism

| Mechanism | Path | Status |
|-----------|------|--------|
| Review template | [CAPABILITY_PROPAGATION_REVIEW_TEMPLATE.md](./templates/CAPABILITY_PROPAGATION_REVIEW_TEMPLATE.md) | Active |
| Feature PRD template | [FEATURE_PRD_TEMPLATE.md](./templates/FEATURE_PRD_TEMPLATE.md) | Active |
| Typed contract | `lib/governance/capability-propagation/types.ts` | Active |
| Capability registry | [CAPABILITY_REGISTRY.json](./capabilities/CAPABILITY_REGISTRY.json) | Active |
| Retrospective audit | [RETROSPECTIVE_CAPABILITY_AUDIT_2026-07-31.md](./capabilities/RETROSPECTIVE_CAPABILITY_AUDIT_2026-07-31.md) | Complete (read-only) |
| Propagation backlog | [CAPABILITY_PROPAGATION_BACKLOG.md](./capabilities/CAPABILITY_PROPAGATION_BACKLOG.md) | **Unimplemented** — not auto-approved |
| Conformance check | `npm run governance:capability-check` | Active |

## Conformance check

```bash
npm run governance:capability-check
npm run governance:capability-check -- --changed-only
```

---

All future features, workflows, experts, reports, and migrations must conform to the Constitution and ratified amendments, or be preceded by a formal constitutional amendment.
