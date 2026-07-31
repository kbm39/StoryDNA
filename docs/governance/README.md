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
| [Amendment 001 — Capability Propagation Principle](./amendments/STORYDNA_CONSTITUTION_AMENDMENT_001_CAPABILITY_PROPAGATION.md) | 1.1.0 amendment | **PROPOSED FOR RATIFICATION** |

**Version relationship:** Constitution v1.0 remains the ratified base document. Amendment 001 supplements v1.0 and does not replace it. When ratified, effective governance is **v1.0 + Amendment 001**.

**Permanent tag:** `storydna-editorial-constitution-v1.0` → ratification commit `c24851c518e2d06e8288c3ecc4e67157b512895e`

## Templates

| Template | Purpose |
|----------|---------|
| [Capability Propagation Review](./templates/CAPABILITY_PROPAGATION_REVIEW_TEMPLATE.md) | Required for every new or materially modified expert/platform capability |
| [Feature PRD](./templates/FEATURE_PRD_TEMPLATE.md) | Includes Constitution Compliance + Capability Propagation Review blocks |

## Capability registry and audit

| Artifact | Path |
|----------|------|
| Capability registry | [CAPABILITY_REGISTRY.json](./capabilities/CAPABILITY_REGISTRY.json) |
| Retrospective audit (2026-07-31) | [RETROSPECTIVE_CAPABILITY_AUDIT_2026-07-31.md](./capabilities/RETROSPECTIVE_CAPABILITY_AUDIT_2026-07-31.md) |
| Propagation backlog | [CAPABILITY_PROPAGATION_BACKLOG.md](./capabilities/CAPABILITY_PROPAGATION_BACKLOG.md) |

## How future capabilities must use the review

Before implementing any new expert or platform capability:

1. Complete a [Capability Propagation Review](./templates/CAPABILITY_PROPAGATION_REVIEW_TEMPLATE.md) using contract `storydna_capability_propagation_review@v1`.
2. Classify the capability as one of: `expert_specific`, `expert_family`, `editorial_board_shared`, `editor_in_chief_owned`, `platform_wide`.
3. Answer all seven propagation questions in Amendment 001.
4. Record the capability in [CAPABILITY_REGISTRY.json](./capabilities/CAPABILITY_REGISTRY.json).
5. Include Constitution Compliance and Capability Propagation Review blocks in the feature PRD.
6. Run `npm run governance:capability-check` before commit.

If no new capability is introduced, declare `no_new_capability: true` with rationale.

## Conformance check

```bash
npm run governance:capability-check
npm run governance:capability-check -- --changed-only
```

Typed contract: `lib/governance/capability-propagation/types.ts`

---

All future features, workflows, experts, reports, and migrations must conform to the Constitution (and ratified amendments) or be preceded by a formal constitutional amendment.
