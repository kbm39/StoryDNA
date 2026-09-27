---
no_new_capability: true
rationale: Governance index; does not introduce a product runtime capability.
---

# StoryDNA Governance

## Constitution Compliance

```json
{
  "applicable_sections": ["§14", "Amendment 001", "Amendment 003"],
  "compliance_explanation": "Index document for governance artifacts present on this branch.",
  "amendment_required": "No",
  "backward_compatibility_impact": "none",
  "certification_impact": "none"
}
```

This directory holds the highest-level architectural authority for StoryDNA editorial operations.

**Branch note:** Constitution v1.0 and Amendments 001–002 were ratified in 2026-07/08 and lived on commits through `357f2da`. They were **not** present on `main` at `29a3a620`. This package restores those three ratified texts plus the two governance templates so Amendment 003 has a local authority chain. Historical implementation frameworks (Editorial Profile, Knowledge Domain Analysis, Conversational Intelligence, Editorial Roadmap, EIC PRDs) and `lib/governance` remain at `357f2da` and are **not** restored here.

---

## Constitutional documents

| Document | Version | Status |
|----------|---------|--------|
| [StoryDNA Editorial Constitution v1.0](./STORYDNA_EDITORIAL_CONSTITUTION_V1.0.md) | 1.0 | **RATIFIED** (2026-07-31) — restored onto this branch from `357f2da` |
| [Amendment 001 — Capability Propagation Principle](./amendments/STORYDNA_CONSTITUTION_AMENDMENT_001_CAPABILITY_PROPAGATION.md) | 1.1.0 amendment | **RATIFIED** (2026-07-31) — restored from `357f2da` |
| [Amendment 002 — Progressive Editorial Understanding](./amendments/STORYDNA_CONSTITUTION_AMENDMENT_002_PROGRESSIVE_EDITORIAL_UNDERSTANDING.md) | 1.2.0 amendment | **RATIFIED** (2026-08-01) — restored from `357f2da` |
| [Amendment 003 — Living Story Bible and Dual Ingestion](./amendments/STORYDNA_CONSTITUTION_AMENDMENT_003_LIVING_STORY_BIBLE.md) | 1.3.0 amendment | **RATIFIED** (2026-09-27) |

**Version relationship:** Constitution v1.0 remains the ratified base. Each amendment supplements prior documents and does not replace them. Effective governance is **v1.0 + Amendment 001 + Amendment 002 + Amendment 003**.

**Permanent tag (Constitution v1.0 only):** `storydna-editorial-constitution-v1.0` → `c24851c518e2d06e8288c3ecc4e67157b512895e`

---

## Living Story Bible package (this branch)

| Document | Role |
|----------|------|
| [Amendment 003](./amendments/STORYDNA_CONSTITUTION_AMENDMENT_003_LIVING_STORY_BIBLE.md) | Constitutional principle |
| [Living Story Bible Framework](./implementation/STORYDNA_LIVING_STORY_BIBLE_FRAMEWORK.md) | Combined LSB + Dual Ingestion + Temporal Canon operating law |
| [Living Story Bible PRD](./implementation/STORYDNA_LIVING_STORY_BIBLE_PRD.md) | Product requirements, fixtures, sequence |
| [Runtime Contract](./implementation/STORYDNA_LIVING_STORY_BIBLE_RUNTIME_CONTRACT.md) | Forbidden implementations and compliance gates |
| [Amendment 003 Capability Propagation Review](./capabilities/AMENDMENT_003_CAPABILITY_PROPAGATION_REVIEW.md) | Amendment 001 review — `platform_wide` |

Dual Ingestion and Temporal Canon are not separate products. They are operating laws of the Living Story Bible.

Protected Archivist Phase 1 surface: commit `29a3a620` — passage-level continuity review.

Series-ready claims require isolated two-book acceptance test **LSB-S1** (Hold Fast: The Reckoning → No Mercy), specified in the Framework. LSB-S1 must not run until its gate is met.

---

## Templates restored for conformance

| Template | Path |
|----------|------|
| Feature PRD | [FEATURE_PRD_TEMPLATE.md](./templates/FEATURE_PRD_TEMPLATE.md) |
| Capability Propagation Review | [CAPABILITY_PROPAGATION_REVIEW_TEMPLATE.md](./templates/CAPABILITY_PROPAGATION_REVIEW_TEMPLATE.md) |

`lib/governance/capability-propagation` and `CAPABILITY_REGISTRY.json` are **not** on this `main` snapshot. `npm run governance:capability-check` is therefore **not** claimed as active here. Amendment 001 still requires a written Capability Propagation Review; that review is the markdown artifact above.

---

## Related code and docs that are not the Living Story Bible

| Artifact | Location | Relationship |
|----------|----------|--------------|
| Archivist Constitution | `experts/archivist/constitution.ts` | Expert rules A–H; not replaced |
| Canon domain | `lib/canon/*` | Authority ranks and Series Bible objects; production queries not wired |
| Downstream consumers | `experts/archivist/downstream-canon.ts` | Read-only expert views |
| Story Understanding | `story_dna` / `app/actions/storydna.ts` | Interpretive discovery blob — must not be redefined as LSB |
| Phase 1 review | `experts/archivist/segmented/observation-v2/review-recommended/` | Incorporated by Amendment 003 |
| Migration 0029 | `supabase/migrations/0029_archivist_review_decisions.sql` | Committed; **not applied** |
| Expert Registry docs | `docs/EXPERT-REGISTRY.md` | Professional constitution of experts |
| Evidence commentary | `docs/EVIDENCE-BACKED-EXPERT-COMMENTARY.md` | Evidence-first sequence |

---

All future features, workflows, experts, reports, and migrations must conform to the Constitution and ratified amendments, or be preceded by a formal constitutional amendment. Amendment 003 is ratified. Ratification still does **not** authorize runtime work until a dedicated implementation task is opened.
