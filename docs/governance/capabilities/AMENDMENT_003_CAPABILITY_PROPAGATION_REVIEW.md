---
no_new_capability: false
rationale: Amendment 001 review for cap.living_story_bible. Documentation only.
---

# Capability Propagation Review — Living Story Bible

Contract: `storydna_capability_propagation_review@v1`

## Constitution Compliance

```json
{
  "applicable_sections": ["§3", "§4", "§7", "§14", "Amendment 001", "Amendment 002", "Amendment 003"],
  "compliance_explanation": "Living Story Bible is a platform story-state capability. Isolation inside Archivist would violate Amendment 001 no-silent-isolation. Classification is platform_wide.",
  "amendment_required": "Yes — Amendment 003",
  "backward_compatibility_impact": "Governance only until a dedicated runtime task. No automatic propagation to expert runtimes.",
  "certification_impact": "Fixtures LSB-T1–T12 required before any expert consumes story-state. No commercial enablement."
}
```

---

## Capability

- **Name:** Living Story Bible
- **ID:** `cap.living_story_bible`
- **Description:** Continuously developing, evidence-backed story-state system across chapter → book → series, with dual ingestion, immutable source history, story time distinct from narrative order, and provenance-distinct author clarification.
- **First expert or feature:** Platform. First visible consumer is Archivist Phase 1 review-recommended (`29a3a620`).
- **Introducing commit:** Documentation package on `main` after `29a3a620` (this task; uncommitted).
- **Current scope:** Governance / design only.

### Related existing capabilities (do not rename)

| Existing | Relationship |
|----------|--------------|
| `cap.manuscript_evidence` | LSB evidence layer consumes it |
| `cap.version_aware_review` | Extended by immutable versions + chapter revisions |
| `cap.series_context` | Series Bible inheritance sits on top |
| `cap.publication_state` | Constitution §7 axis remains separate |
| `cap.immutable_provenance` | Expert artifacts stay immutable; LSB adds source immutability |
| `cap.editorial_roadmap` | Future consumer of Needs Fix |
| `cap.report_exports` | Print/PDF/Export attachment point |
| `cap.progressive_editorial_understanding` | Distinct. Editorial Understanding ≠ Living Story Bible |

---

## Constitutional Classification

- [x] Platform-wide (`platform_wide`)

**Isolation reason:** not expert-specific.

A Bible built only inside Archivist would force every later expert to duplicate or ignore story-state. Amendment 001 forbids that isolation.

---

## Prospective Review

- **Which future experts may need this?** Archivist (full), Continuity, Timeline, Military, Police, Mob, Psychologist, Developmental Editor, Literary Agent (readiness only), EIC (synthesis).
- **Should new experts inherit it by default?** They inherit the **read-contract obligation** (use governed views; do not mutate). They do not inherit write access.
- **Does it belong in a shared contract?** Yes: `storydna_living_story_bible@v1` + runtime contract.
- **Does it require certification before reuse?** Yes — fixtures LSB-T1–T12 before story-state consumption.
- **Would propagation increase cost or runtime?** Yes if every expert re-extracts. Mitigation: shared Bible + purpose-specific views. Incremental invalidation later; accuracy first.
- **Would propagation create safety risk?** Yes if working state is treated as canon, or if reads can write. Contract forbids both.

---

## Retrospective Review

| Expert | Applicable | Reason | Implementation | Certification | Migration | Tests |
|--------|------------|--------|----------------|---------------|-----------|-------|
| Literary Agent | Later | Readiness / unresolved continuity only; not raw internals | Not started | Not started | None | Later view tests |
| Military Expert | Later | Mission-time rank, injury, capability, equipment, location | Not started | Not started | None | After read contract |
| Developmental Editor | Later for production consume; design/calibration may begin now | Timeline, flashback, knowledge progression. Production must not consume LSB until read contract + LSB foundations are tested. | Not started (do not implement in this package) | After LSB-T1–T12 + read contract | None | After read contract |
| Thriller Editor | Later | Same as DE if recruited | Not started | — | — | — |
| Combat Medicine Expert | Later | Injury history at event time | Not started | — | — | — |
| Medical Expert | Later | Same family as CME | Not started | — | — | — |
| Financial Crimes Expert | No | Domain does not consume story-state initially | — | — | — | — |
| Intelligence Expert | Later | Knowledge / location if recruited | Not started | — | — | — |
| Character Expert | Later | Relationship / knowledge / appearance history | Not started | — | — | — |
| Timeline Expert | Yes | Story time is core | Not started | Fixtures T1–T12 | None yet | Required |
| Continuity Expert | Yes | Cross-chapter / series state | Not started | Fixtures T1–T12 | None yet | Required |
| Archivist | Yes | First consumer; Phase 1 review already shipped | Phase 1 only (`29a3a620`) | Isolated V2 evals historical | `0029` committed, not applied | Phase 1 tests exist |
| Line Editor | No | Prose, not story-state | — | — | — | — |
| Psychologist | Later | Relationship / knowledge / trauma history | Not started | — | — | — |
| Research Librarian | No | External sources, not LSB | — | — | — | — |
| Security/Construction Expert | No | Physical-world domain | — | — | — | — |
| Editor-in-Chief | Yes | Synthesis view; no mutation | Not started | — | — | Derived-view tests later |
| Police Expert | Later | Event-time location / possession | Not started | — | — | After read contract |
| Organized Crime / Mob Expert | Later | Event-time relationships / allegiance | Not started | — | — | After read contract |

**Propagation decision:** `move_to_platform`

Do **not** retroactively rewrite Literary Agent or Military Expert runtimes to consume LSB. Each consumer still needs its own implementation task after the read contract exists.

Future experts receive the read-contract by default. They do not receive write paths.

---

## Author Experience

- **Does this change what the author sees?** Not in this documentation task. Future runtime adds a Living Story Bible surface and keeps Phase 1 review cards.
- **Does it change report labels?** Future reports may cite working state vs canon vs clarification. Must not relabel `story_dna` as Living Story Bible.
- **Does it change cost?** Future ingest/audit will cost more than a blob. Incremental update exists to limit reruns without sacrificing accuracy.
- **Does it change runtime?** Future only.
- **Does it change Revision Board behavior?** Needs Fix may later create editorial roadmap work items. Not now.
- **Does it require author consent?** Author Intent and publication state remain author-declared. Clarification and canon promotion remain explicit.

---

## Decision

- **Final classification:** `platform_wide`
- **Propagation decision:** `move_to_platform`
- **Reason:** Story-state, dual ingestion, temporal history, and source immutability apply across StoryDNA. Isolating them in Archivist would duplicate or starve later experts.
- **Approved by:** Kevin Martin, Founder — Amendment 003 ratified 2026-09-27
- **Date:** 2026-09-27
- **Follow-up tasks:**
  1. Immutable manuscript versions
  2. Stable chapter identity
  3. Converged Bible schema + temporal history
  4. Governed read contract
  5. LSB-S1 only after the Framework gate
  6. Per-expert **production** consumer tasks after that contract (design/calibration may begin earlier)
