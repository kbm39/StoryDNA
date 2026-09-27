---
no_new_capability: false
rationale: Product requirements for cap.living_story_bible. No runtime in this task.
---

# Living Story Bible PRD

## Summary

- **Feature name:** StoryDNA Living Story Bible / Dual Ingestion
- **Owner:** Platform (not a single expert)
- **Target phase:** Governance complete (this document). Runtime unauthorized until a dedicated implementation task.
- **Constitution baseline:** v1.0 + Amendment 001 + Amendment 002 + Amendment 003 (RATIFIED 2026-09-27)
- **Protected code baseline:** `29a3a620ddb9842d776d8230bd975556ef1912a8`

---

## Constitution Compliance

```json
{
  "applicable_sections": [
    "§0",
    "§3",
    "§4",
    "§7",
    "§9",
    "§12",
    "§13",
    "§14",
    "§15",
    "Amendment 001",
    "Amendment 002",
    "Amendment 003"
  ],
  "compliance_explanation": "PRD implements Amendment 003 without renaming §7 canon states, §4 delta review, or Amendment 002 framing-versus-evidence. Author remains final authority. Evidence remains first. Fail-closed temporal rules prevent invented chronology.",
  "amendment_required": "Yes — Amendment 003 (RATIFIED 2026-09-27)",
  "backward_compatibility_impact": "Documentation only in this task. Future runtime must not mutate historical evaluations, story_dna, or applied 0029. Current in-place version overwrite becomes forbidden once LSB runtime ships.",
  "certification_impact": "No expert commercially enabled. Fixtures LSB-T1–T12 required before story-state consumption. Series-ready claims require LSB-S1 after its Framework gate."
}
```

## Capability Propagation Review

```json
{
  "new_capability_introduced": "Living Story Bible (cap.living_story_bible)",
  "existing_capability_modified": "cap.version_aware_review; cap.series_context; cap.report_exports; Archivist review-recommended 29a3a620",
  "classification": "platform_wide",
  "existing_experts_evaluated": [
    "archivist",
    "literary_agent",
    "military_expert",
    "developmental_editor",
    "editor_in_chief"
  ],
  "future_experts_affected": [
    "continuity_expert",
    "timeline_expert",
    "police_expert",
    "organized_crime_expert",
    "psychologist"
  ],
  "editor_in_chief_impact": "Governed synthesis view only. No specialist judgment generation.",
  "platform_impact": "One story-state architecture for Mode A and Mode B ingestion.",
  "certification_impact": "Deterministic fixtures before consumption. Export remains cap.report_exports.",
  "propagation_decision": "move_to_platform",
  "review_artifact_path": "docs/governance/capabilities/AMENDMENT_003_CAPABILITY_PROPAGATION_REVIEW.md"
}
```

---

## Problem

StoryDNA cannot yet keep an evidence-backed story world that:

- survives revision without overwriting prior evidence sources;
- accepts both a complete manuscript and chapter-by-chapter writing;
- distinguishes story time from chapter order;
- keeps 2011 and 2026 injury states both true;
- shows fail-closed continuity questions to the author without pretending they are canon.

`story_dna` is an interpretive blob. `lib/canon` is a domain model with no production query path. Archivist V2 observations stuff locators into `temporal_scope.chapter`. `uploadRevision` overwrites current text.

---

## Goals

1. Formalize one Living Story Bible as a platform capability.
2. Require Mode A and Mode B to converge on one architecture.
3. Prohibit silent overwrite of analyzed manuscript versions.
4. Make chapter identity first-class and distinct from chapter revision.
5. Establish story time, precision, fail-closed unknown time, and state histories.
6. Keep author clarification provenance-distinct.
7. Incorporate Phase 1 passage-level review from `29a3a620`.
8. Bind Needs Fix to a future correction path without implementing it.
9. Attach print/PDF/export to `cap.report_exports`, not LSB core.

---

## Non-goals

- Runtime implementation of any LSB table, UI, or ingestion mode
- Applying migration `0029` or any migration
- Changing `diagnoseInjury` / `comparison.ts` / prompts / adapters
- Relaxing unspecified-laterality
- Aliasing `injury_event` → `injury_event_id`
- Rewriting official evaluation artifacts
- Redefining `story_dna` as the Bible
- Implementing correction, Series Bible UI, or export
- Beginning the next expert's story-state consumer
- Cleaning or committing leftover dirty Archivist work

---

## Acceptance criteria

A future implementation is compliant only if all twenty principles are testable and pass:

| # | Principle | Test idea |
|---|-----------|-----------|
| 1 | Whole-manuscript and progressive ingestion converge into one Bible | Same chapter revision produces identical evidence identity regardless of Mode A vs Mode B |
| 2 | Source manuscript history is immutable | Updating text creates a new version/revision; prior `content_hash` rows remain |
| 3 | Chapter identity is distinct from chapter revision | Prose edit changes revision hash, not chapter id |
| 4 | Story time is distinct from narrative order | LSB-T4: Ch20/2011 after Ch19/2026 does not order 2026 before 2011 in story time |
| 5 | Unknown temporal relationship fails closed | LSB-T11: no contradiction and no auto event-split |
| 6 | Temporal precision is preserved | LSB-T6: relative/month/year stay at that precision |
| 7 | Later states do not erase earlier historically correct states | LSB-T1: both Cole wounds remain |
| 8 | Author clarification remains provenance-distinct | LSB-T7: usable, labeled AUTHOR-SUPPLIED |
| 9 | Working story state is not automatically accepted canon | Extraction/insert cannot set `accepted` |
| 10 | Needs Fix is not a manuscript edit or contradiction | Decision row cannot write manuscript or `confirmed_contradiction` |
| 11 | Not an Issue is not factual equivalence | Engine eligibility remains `insufficient_semantic_specificity` |
| 12 | Changed evidence invalidates affected dependencies | LSB-T8: year change reconsiders dependents |
| 13 | Unchanged evidence/decisions remain stable where safe | LSB-T9: unchanged chapter keeps identity + decisions |
| 14 | Progressive ingestion retains final whole-book audit | Mode B completed book still has a final-audit gate |
| 15 | Series canon cannot be silently overwritten | LSB-T10: later book hits conflict/retcon path |
| 16 | Experts receive governed read views | Consumer queries are typed views; no write API |
| 17 | Expert reads cannot mutate canon | Read function has no store mutation |
| 18 | Historical evaluations are not rewritten retroactively | Official `da1cb4fb` / `b30594ca` / `8911acab` reports unchanged |
| 19 | `story_dna` is not silently redefined as LSB | `story_dna` table and LSB store remain separate types |
| 20 | Print/PDF/export remains a separate presentation capability | No LSB-only export implementation; uses `cap.report_exports` |
| 21 | Clean two-book series acceptance (LSB-S1) | Isolated Hold Fast: The Reckoning → No Mercy. Full sequence and gate in Framework §14 LSB-S1. Not run until that gate exists. |

---

## Deterministic fixtures

Required cases LSB-T1–T12 are specified in the [Framework](./STORYDNA_LIVING_STORY_BIBLE_FRAMEWORK.md) §14. They are design fixtures. They do not authorize inspection of held-out Rule 8 cases or paid reruns.

## Series acceptance test

**LSB-S1** (Hold Fast / The Reckoning as Book 1 → No Mercy as Book 2) is specified in the Framework §14 LSB-S1 section. Do not duplicate the 23-step sequence here.

LSB-S1 uses an isolated new series test state. It must not destroy historical calibration data, unrelated uploads, official evaluations, or the development database indiscriminately. It must not run until the LSB-S1 gate is met. Print/PDF/export does not block LSB-S1.

---

## Test plan

Governance-only for this task: document existence and principle coverage.

Future runtime test plan (not executed now):

1. Unit tests for version immutability and chapter identity vs revision.
2. Unit tests for precision preservation and unknown-time fail-closed.
3. Fixture battery LSB-T1–T12.
4. Phase 1 review-decision meaning tests remain (`29a3a620`).
5. Downstream consumer tests: read-only, no canon write.
6. Negative tests: `story_dna` upsert does not create LSB rows.
7. LSB-S1 only after the Framework gate — never as a substitute for T1–T12, and never against historical calibration series state.

---

## Rollout / certification gates

| Gate | Required before |
|------|-----------------|
| Amendment 003 ratification (complete 2026-09-27) | Treating LSB as constitutional law |
| Immutable versions + chapter identity | Any LSB persistence |
| Dual-ingestion convergence model | Mode B UI |
| Working state + temporal history + fixtures T1–T12 | Any expert consuming story-state |
| Governed read contract | Military / Police / Mob / Psychologist / DE **production** Bible reads |
| LSB-S1 gate (Framework §14) | Running the Reckoning → No Mercy acceptance test; claiming series-ready |
| Final audit design | Claiming Mode B books are continuity-complete |
| Series inheritance + retcon path | Book 2 consumption of Book 1 history (also required for LSB-S1) |
| `cap.report_exports` work | Print / PDF / Export — **does not block LSB-S1** |

No expert is commercially enabled by this PRD.

---

## Implementation sequence

```
immutable manuscript versions
  → stable chapter identity
    → dual-ingestion convergence
      → Living Story Bible working model
        → temporal anchors / state history
          → incremental invalidation
            → author clarification
              → final audit
                → Series Bible
                  → correction workflow
                    → broader expert consumption
                      → print / export
```

### MUST BUILD BEFORE NEXT EXPERT THAT CONSUMES STORY-STATE

These are required before Military, Police, Mob, Psychologist, or any new continuity consumer may treat StoryDNA story-state as an input:

1. Immutable manuscript versions
2. Stable chapter identity
3. One converged Bible schema (Mode A can write it; Mode B UI may still be later)
4. Working story state with temporal anchors and state histories
5. Governed read contract (even if only Archivist uses it first)
6. Fixtures LSB-T1–T12 passing against that model

**Military Expert (and others) may continue work that does not read the Living Story Bible** — provider contracts, certification, domain prompts — without waiting for the full LSB stack.

**Developmental Editor boundary.** Developmental Editor **design and calibration** MAY begin before the entire Living Story Bible runtime is complete. A Developmental Editor **production** capability that consumes Living Story Bible story-state MUST NOT depend on that state until the minimum governed read contract and required LSB foundations are implemented and tested. This PRD does not implement the Developmental Editor.

### CAN FOLLOW LATER

- Mode B progressive-upload UI
- Incremental invalidation (full affected-set re-run is acceptable first)
- Author-clarification UI and supersession history
- Productized final audit
- Series Bible inheritance UI
- Correction workflow (Needs Fix → roadmap work item → revision)
- Additional expert views beyond Archivist
- Print / Save as PDF / Export via `cap.report_exports`

### Explicitly not on the critical path for continuing isolated Archivist calibration

Archivist V2 pairing, object-chain repair (`72bb3f0`), and Phase 1 review (`29a3a620`) remain valid without LSB runtime. Do not block leftover dirty Archivist work on LSB implementation.

---

## Current-system constraints the runtime must replace (later)

| Current behavior | LSB requirement |
|------------------|-----------------|
| `uploadRevision` / `applyEditsToManuscript` overwrite current text | New immutable version / chapter revision |
| No chapter table | Stable chapter identity |
| Reckoning-locked structural units | General, provenance-preserving chapter identity |
| `candidateCanonFromV2Observations` sets `temporal_scope.chapter = locator` | Story-time anchors with precision |
| `compareTemporalScopes` uses chapter digits | Narrative order ≠ story time |
| `TIME_VARYING_EXCLUSIVE` = age, appearance, alive_status, rank_title only | Broader justified histories, including injury |
| `story_dna` unique per manuscript jsonb | Separate LSB store |
| `0029` unapplied | Do not assume live review-decision table |

---

## Open product questions (do not invent answers)

See Amendment 003 / Framework risks. Defaults until founder decides:

| Question | Default |
|----------|---------|
| How are split/merge identities confirmed? | Fail closed to author confirmation |
| Does Mode A auto-create chapter identities on first LSB ingest? | Yes, after a general (non-Reckoning-locked) detector exists |
| May working state be shown to authors before any accepted canon? | Yes, labeled as working understanding, not canon |
