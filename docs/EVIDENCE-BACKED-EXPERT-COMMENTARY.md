# Evidence-Backed Expert Commentary

Every material StoryDNA expert comment must be independently verifiable by the author. The Expert Registry **declares** these requirements in Phase 1; future Expert Runtime **enforces** them deterministically.

## Evidence-first sequence

```
Evidence → Reasoning → Observation → Recommendation
```

Do **not** design around: Observation → find evidence afterward.

## Material comment structure (future runtime)

Every material expert observation must eventually include:

1. **CLAIM** — what is being asserted
2. **EVIDENCE** — supporting material
3. **EVIDENCE TYPE** — enum (see below)
4. **EVIDENCE LOCATION** — manuscript locator or external citation
5. **REASONING** — how evidence supports the claim
6. **CONFIDENCE** — HIGH | MODERATE | LOW | INSUFFICIENT_EVIDENCE
7. **VERIFICATION INSTRUCTIONS** — how the author can confirm
8. **CONTRARY EVIDENCE** — conflicting or mitigating evidence
9. **RECOMMENDATION** — actionable next step (if applicable)
10. **LIMITATIONS** — scope and uncertainty

## Evidence types

| Type | Use |
|------|-----|
| `MANUSCRIPT` | Direct text from the reviewed manuscript version |
| `EXTERNAL_SOURCE` | Third-party reference (market, science, history, etc.) |
| `ANALYTICAL` | Derived analysis from manuscript structure/metadata |
| `RUBRIC` | Applied scoring rubric or editorial principle |
| `COMPARATIVE` | Comparable title or market reference |
| `AUTHOR_PROVIDED` | Author-supplied context or sources |
| `SYSTEM_METADATA` | Word count, version, workflow metadata |

## Mandatory rules

- No material comment without **at least one evidence record**.
- Editorial opinions must cite **manuscript evidence** and name the **principle or rubric** applied.
- Factual/realism claims require **reliable external evidence** unless established in the manuscript or supplied by the author.
- Distinguish **fact**, **interpretation**, **prediction**, **preference**, and **professional judgment**.
- Never fabricate quotations, citations, locations, links, or chapter references.
- If evidence is insufficient → return **`INSUFFICIENT_EVIDENCE`**, do not assert the concern.
- Evidence must tie to the **exact manuscript version** reviewed.
- Historical reviews retain **original evidence** (future tables).
- **Manuscript text must never be stored** inside Expert Registry definitions.

## Evidence profiles

Reusable profiles (`lib/expert-registry/evidence-profiles.ts`) define baseline requirements:

- EDITORIAL, COMMERCIAL, RESEARCH, SCIENTIFIC, HISTORICAL, MEDICAL, LEGAL, PSYCHOLOGICAL, PUBLISHING, GENERAL_FACT_CHECKING

Experts reference one or more profiles and may apply **stricter** overrides only. Validation rejects overrides that weaken profile baselines.

## Contrary evidence

Before repeating a prior criticism, experts must search the **current manuscript version** for:

- contrary evidence, or
- evidence that the issue was repaired

Allowed statuses without score deduction: `RESOLVED`, `STALE_CRITIQUE` (Literary Agent gate already implements this at runtime).

## Phase 1 vs Phase 2

| Phase 1 | Phase 2+ |
|---------|----------|
| Evidence requirements in `ExpertDefinitionV1` | Structured `expert_evidence` rows |
| Profile definitions in code | Optional DB-backed profiles |
| Validation at definition ingest | Validation at execution publish |

Future tables (designed for, not implemented): `expert_observations`, `expert_evidence`, `manuscript_evidence_anchors`, `contrary_evidence_assessments`, `external_sources`.
