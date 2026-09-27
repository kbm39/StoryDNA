---
no_new_capability: false
rationale: Fail-closed implementation constraints for cap.living_story_bible. Not a runtime module.
---

# Living Story Bible Runtime Contract

**Contract:** `storydna_living_story_bible_runtime@v1`  
**Status:** Design constraint — no runtime ships in this task  
**Protected baseline:** `29a3a620ddb9842d776d8230bd975556ef1912a8`

An implementation is **non-compliant** if it violates any rule below, even if the UI looks complete.

---

## 1. What must be true before an implementation is compliant

1. Mode A and Mode B write the same `series → manuscript → version → chapter identity → chapter revision → evidence` model.
2. Analyzed manuscript versions are immutable. New text creates a new version or chapter revision.
3. Chapter identity and chapter revision are different keys.
4. Story-time fields are not populated from chapter number, segment order, or manuscript position alone.
5. Temporal values retain declared precision. No silent date coercion.
6. Unknown temporal relationship does not emit a confirmed contradiction or an invented event split.
7. Time-varying histories keep earlier historically correct states.
8. Author clarification rows are labeled AUTHOR-SUPPLIED and `is_manuscript_evidence = false` until promoted.
9. Working story state inserts cannot set accepted / Published / Locked canon.
10. Phase 1 review decisions remain passage-level and do not write canon or Series Bible.
11. Not an issue does not change engine classification to equivalent.
12. Needs fix does not edit manuscript text and does not set `confirmed_contradiction`.
13. Evidence-hash changes invalidate dependents; unchanged hashes keep decisions.
14. A Mode B book still has a final-audit capability.
15. Later-book writes cannot silently replace prior accepted historical states.
16. Expert consumer APIs are read-only.
17. Official historical evaluation artifacts are not rewritten.
18. `story_dna` remains a separate product store.
19. Print / PDF / Export is not implemented inside LSB core.
20. Fixtures LSB-T1–T12 have deterministic tests.
21. Series-ready claims require LSB-S1 after the Framework gate. LSB-S1 must not run before that gate. Print/PDF/export is not part of the gate.

---

## 2. Forbidden implementations

| Forbidden | Why |
|-----------|-----|
| `UPDATE manuscript_versions SET content_hash / extracted text` on an analyzed row | Destroys evidence provenance |
| Separate Mode B Bible tables that experts must special-case | Breaks dual-ingestion convergence |
| Using Reckoning `extractStructuralUnits` as general chapter identity | Unsafe and book-specific |
| Fuzzy/embedding chapter matching without audit + author confirm | Non-deterministic identity |
| `temporal_scope.chapter = locator` as story time | Narrative order ≠ story time |
| Chapter-digit `compareTemporalScopes` as chronology | Same |
| Coercing month/year/relative/unknown to `Date` midnight | False precision |
| Inventing `injury_event_id` / event IDs from body region, locator, chapter, scene, or year | Event ≠ temporal identity |
| Aliasing prompt `injury_event` to `injury_event_id` | Recorded pipeline failure; do not paper over |
| Relaxing `unspecified_laterality` inside LSB work | Separate Archivist comparison question |
| Treating working state as accepted canon | Constitution §7 / Archivist Rule A |
| Writing accepted canon from extraction | Existing `EXTRACTION_CANNOT_ACCEPT_CANON` |
| Representing author clarification as manuscript-derived | Amendment 002 / Amendment 003 |
| Collapsing Not an issue / Needs fix into engine diagnosis | `29a3a620` grain |
| Expert read functions that insert/update Bible or canon rows | Consumers are readers |
| Redefining `story_dna.data` as LSB | Principle 19 |
| Rewriting official reports for `8911acab`, `b30594ca`, `da1cb4fb` | Principle 18 |
| Applying `0029` or any migration from a governance task | Documentation is not operations |
| Calling an AI provider to "seed" the Bible | Cost and invention risk |
| Per-expert Print/PDF implementations | `cap.report_exports` |
| Running LSB-S1 before the Framework gate | Test would not be meaningful |
| Using historical Reckoning calibration / official evals as LSB-S1 series state | Violates isolated new series test state |
| Deleting historical calibration or official evaluations to "clean" for LSB-S1 | "Clean" means isolated test series only |

---

## 3. Required identities (design, not schema)

| Identity | Composition rule |
|----------|------------------|
| Manuscript version | Immutable row; content hash of full analyzed text |
| Chapter identity | Stable id assigned with provenance; not the display title |
| Chapter revision | Chapter identity + content hash of that chapter's text |
| Evidence identity | Locator + SHA-256(normalized excerpt) — already used by `29a3a620` |
| Passage decision key | SHA-256(manuscript_id + manuscript_version_id + evidence_identity) |
| Cluster fingerprint | Grouping only; not the decision grain |
| Temporal anchor | Precision kind + value as evidenced; optional event_id only when established |
| Clarification id | Append-only revisions; supersession points at prior id |

Do not invent event IDs to fill empty optional fields.

---

## 4. Authority write paths

| Actor | May write | May not write |
|-------|-----------|---------------|
| Extraction / observation adapter | Manuscript evidence, working state (candidate) | Accepted canon, Series Bible, review decisions, manuscript text |
| Author review (`29a3a620`) | Passage `not_an_issue` / `needs_fix` | Canon, Series Bible, manuscript, engine classification |
| Author clarification | AUTHOR-SUPPLIED clarification + history | Manuscript evidence label, silent canon |
| Author promotion / bible_import | Accepted canon, Series Bible revision, retcon | Silent overwrite of higher authority |
| Expert consumer | Nothing | Everything |
| EIC | Synthesis view records (derived, append-only) | Expert artifacts, canon, manuscript |

---

## 5. Temporal comparison contract

Given two working states for the same entity and topic:

| Established relationship | Allowed conclusion |
|--------------------------|--------------------|
| Disjoint story-time, compatible transition | Both retained; not a contradiction |
| Identical / overlapping story-time, incompatible values | Continuity comparison may proceed |
| Unknown relationship | Fail closed; optional review only if eligibility allows |
| Narrative order only (chapter 19 then 20) | Insufficient for chronology |

Injury laterality rules in `diagnoseInjury` are unchanged by this contract.

---

## 6. Invalidation contract

```
chapter revision hash changes
  → evidence with that chapter revision becomes stale
    → working states citing stale evidence become reconsidered
      → continuity findings citing those states become reconsidered
        → passage decisions remain if evidence_identity still matches
          → passage decisions reopen if evidence_identity changes
```

If the dependency closure cannot be proved, enlarge the rerun set. Never shrink it for cost.

### LSB-S1 run gate

Do not run Hold Fast / The Reckoning → No Mercy (LSB-S1) until all of the following exist and have tests:

1. Immutable manuscript versions
2. Stable chapter identity
3. Dual-ingestion convergence onto one Bible schema (Mode A write path sufficient)
4. Living Story Bible working-state schema
5. Temporal anchors / state histories
6. Governed prior-volume read
7. Continuity review wired to LSB evidence (Phase 1 passage-level surface)
8. Series Bible projection

Print/PDF/export, correction workflow, incremental invalidation, and other expert production consumers are **not** on this gate. Full sequence: Framework §14 LSB-S1.

---

## 7. Historical artifact freeze

Do not mutate:

- workflow `8911acab-2ea0-44a7-b5ad-b677c57e185b`
- workflow `b30594ca-c56f-4379-b40b-6a2349f259ed`
- workflow `da1cb4fb-2f6d-4f6d-945b-eb0baa5cc12f`
- workflow `293c23d7-2793-4f79-bb97-5eb3ab8ae7fc`
- official reports under `.calibration-results/`
- consumed authorizations

Code replay of saved observations at $0 remains allowed.

---

## 8. This task's operational freeze

Documentation work must keep:

- provider calls = 0
- provider cost = $0.00
- database writes = 0
- migrations applied = 0
- authorization changes = 0
- workflow mutations = 0
- runtime / application files unmodified
- leftover dirty / untracked Archivist work untouched
