---
no_new_capability: false
rationale: Operating framework for cap.living_story_bible; implementation remains unauthorized until a dedicated runtime task.
---

# StoryDNA Living Story Bible Framework

**Capability:** `cap.living_story_bible`  
**Contract (design):** `storydna_living_story_bible@v1`  
**Status:** Design complete — not implemented  
**Constitution baseline:** v1.0 + Amendment 001 + Amendment 002 + Amendment 003 (RATIFIED 2026-09-27)  
**Incorporates:** commit `29a3a620ddb9842d776d8230bd975556ef1912a8`

Dual Ingestion and Temporal Canon / State-Over-Time are **not** separate products. They are operating laws of the same Living Story Bible. This document is the combined framework.

---

## 1. Why this capability exists

Authors need a continuously developing, evidence-backed understanding of the story world that survives revision, chapter-by-chapter writing, flashbacks, and series inheritance.

StoryDNA already has fragments: Archivist observations, `lib/canon` types, Series Bible revision objects, Phase 1 review-recommended cards, and a `story_dna` blob. None of those is a Living Story Bible.

Without this framework, experts invent chronology from chapter numbers, overwrite evidence sources, and treat working observations as canon.

---

## 2. What the Living Story Bible is

The Living Story Bible is StoryDNA's continuously developing, evidence-backed understanding of the author's story world across:

```
chapter → book → series
```

It is a **governed story-state system** grounded in manuscript evidence and author authority.

It is **not**:

| Look-alike | Why it is not the Bible |
|------------|-------------------------|
| Generated report | Reports present the Bible; they are not the Bible |
| Static Series Bible | Series Bible is an accepted inheritance view of book Bibles |
| `story_dna` / Story Understanding | One-shot interpretive discovery (`story_dna.data` jsonb). Alignment feedback is not story-state. |
| Accepted / Published Canon | Canon is a promotion of selected Bible facts through a human-authority gate |
| Model memory | Providers do not own story-state |
| The manuscript | The manuscript is the source. The Bible is understanding derived from it. |

**Governing maxim:** *The manuscript is the text. The Bible is the governed state of the world that text establishes.*

---

## 3. Dual ingestion

### Mode A — Complete manuscript

The author uploads a complete manuscript. StoryDNA identifies chapters automatically and processes them as narrative units. The author must not be required to manually split a finished book.

Current production `uploadManuscript` is Mode A only and has no chapter table. Future Mode A must emit stable chapter identities, not Reckoning-locked `CHAPTER 1–29` parsing as the general identity scheme.

### Mode B — Build as I write

The author adds chapters progressively. Each chapter updates the **same** Living Story Bible.

### Convergence rule

Both modes MUST write:

```
series → manuscript → immutable manuscript version → stable chapter identity → chapter revision → evidence
```

Experts consume Bible views. They must not branch on `ingestion_mode`.

Mode B does not skip final whole-book audit. Mode A does not skip chapter identity.

---

## 4. Source, version, and chapter

### Immutable source history

Required future chain:

```
manuscript
  → manuscript version          (immutable once analyzed)
    → chapter identity          (stable across ordinary edits)
      → chapter revision        (content + hash)
        → evidence
```

**Prohibited future behavior:** silently updating the current `manuscript_versions` row so prior analysis loses its source.

Observed current non-compliance (must not be "fixed" by this documentation task):

- `uploadRevision` updates `manuscripts.extracted_text` in place;
- `applyEditsToManuscript` mutates current text;
- Trigger creates `manuscript_versions` v1, then later hashes change on the same row.

Constitution §4 already requires edition lineage. This framework adds the storage rule those reviews need: **analyzed source is append-only**.

### Chapter identity vs chapter revision

| Concept | Stable across ordinary prose edits? | Changes when |
|---------|-------------------------------------|--------------|
| Chapter identity | Yes | Add, delete, split, merge, or author-declared identity change |
| Chapter revision | No | Text, heading display title, or content hash changes |

Display title ("CHAPTER TWENTY" / "The Wash") may change without changing identity.

The future runtime must record, with provenance:

- chapter added
- chapter edited
- chapter deleted
- chapter moved
- chapter renamed
- chapter split
- chapter merged

Governance does **not** prescribe fuzzy title matching, word-count similarity, or embedding match as identity. Any matcher must be deterministic and must leave an audit trail. Ambiguous identity fails closed to author confirmation.

Reckoning `extractStructuralUnits` (PROLOGUE + CHAPTER 1–29 / ONE–TWENTY-NINE) is a calibration parser, not general chapter identity.

---

## 5. Authority model

Three axes remain distinct. Do not collapse them.

### Axis A — Publication-canon states (Constitution §7)

Draft / Published / Locked / Retconned / Historical / Disputed Canon.

### Axis B — Fact-authority ranks (`lib/canon`)

`author_approved_exception` (6) > `series_bible_accepted` (5) > `prior_volume_canon` (4) > `current_observation` (3) > `inferred` (2) > `uncertain_observation` (1).

Lower authority must not silently replace higher authority.

### Axis C — Living Story Bible layers (this framework)

| Layer | Definition | May become canon automatically? |
|-------|------------|----------------------------------|
| 1. Manuscript evidence | What the source text establishes, pinned to version + chapter revision + locator + excerpt identity | No |
| 2. Working story state | Evidence-backed current understanding | No |
| 3. Author clarification | Explicit author-supplied information, labeled AUTHOR-SUPPLIED | No |
| 4. Accepted / authoritative canon | Human-authority promotion | Already canon |
| 5. Unresolved continuity question | Fail-closed engine or missing temporal/event identity | No |
| 6. Needs-fix editorial issue | Author decision that a passage needs attention | No |

Working story state is not Draft Canon. Needs Fix is not Disputed Canon. Not an Issue is not factual equivalence.

### Engine classification vs author review

Phase 1 (`29a3a620`) preserves engine eligibility (`insufficient_semantic_specificity` / `unspecified_laterality`) separately from author `pending` / `not_an_issue` / `needs_fix`. That separation is constitutional for LSB.

Neither author action writes accepted canon or Series Bible.

---

## 6. Temporal canon and state-over-time

### Principle

> Continuity facts are stateful over story time. A later or different established story-time state does not contradict an earlier state merely because subject and topic match. Where the manuscript does not establish temporal relationship, StoryDNA must not invent one.

### Story time ≠ narrative order

| Property | Meaning |
|----------|---------|
| Narrative order | Chapter identity, segment order, manuscript position, locator |
| Story time | When, in the fiction, the state obtained |

`lib/canon` `compareTemporalScopes` currently uses chapter numbers as interval bounds. That is narrative order. Future LSB runtime must not treat those bounds as story chronology.

Example: Chapter 19 in 2026, Chapter 20 flashback to 2011. Story chronology is 2011 then 2026. Narrative order is 19 then 20.

### Temporal precision

Preserve the precision the evidence supports. Do not upgrade precision.

Required precision kinds:

`exact_date` · `month_year` · `year` · `approximate` · `relative` · `historical_event` · `sequence_only` · `range` · `unknown`

Forbidden conversions:

- November 2011 → November 1, 2011
- 2026 → January 1, 2026
- three weeks after the bombing → a calendar date, unless evidence supports the conversion

### Unknown time fails closed

If temporal relationship is unknown:

- do not invent chronology;
- do not automatically declare a contradiction;
- do not automatically declare separate events;
- do not silently treat chapter order as earlier/later in story time.

Author review is allowed only through governed eligibility (Phase 1 allowlist today: `unspecified_laterality`).

### State histories

Time-varying facts keep histories, not one current row that erases the past.

Example — Cole injury history:

| Story time | State | Source |
|------------|-------|--------|
| 2011 | Upper-arm gunshot wound | manuscript evidence |
| 2026 | Left upper-arm graze | manuscript evidence |

Both can be true. The 2026 graze does not erase the 2011 gunshot.

Apply history where justified:

- injuries
- residence / location
- relationships
- employment / role
- rank / title
- allegiance / organization
- possessions
- alive / dead
- knowledge
- capabilities
- recurring objects

Do not invent history for inherently stable identity facts (legal name once established, unless the manuscript shows change).

### Event identity vs temporal identity

| Identity | Question |
|----------|----------|
| Temporal | When did this obtain? |
| Event | Which happening is this? |

Rules:

- Same year ≠ same event.
- Same location ≠ same event.
- Different locations ≠ automatically different events.
- Different established years normally establish different temporal states.
- Residual references remain possible: a 2026 ache from a 2011 wound is a 2026 state about a 2011 event.

Forbidden event-ID invention from body region, locator, chapter, scene, or year alone.

Do not alias prompt field `injury_event` to schema field `injury_event_id`. That pipeline gap is recorded; it is not a license to guess IDs.

### Current extraction loss (governance warning)

Saved V2 observations attach `temporal_scope: { kind: "at", chapter: locator }` — narrative locator stuffed as time. Injury comparison ignores time. This framework forbids promoting that pattern into LSB runtime.

---

## 7. Author clarification

Author clarification is first-class story-state input and **not** manuscript evidence.

Required operations:

- create
- provenance (`AUTHOR-SUPPLIED`)
- revision
- supersession
- audit history

Prior clarifications remain readable after supersession.

Clarification may inform future reasoning (for example, "2011 and 2026 Cole wounds are separate injuries") without becoming Accepted Canon until a human-authority gate promotes it.

Editorial Understanding (Amendment 002) remains a separate conversational artifact about author goals and reader experience.

---

## 8. Continuity review integration

Incorporated surface from `29a3a620`:

- Label: **Potential continuity issue — review recommended**
- Clustered display by manuscript + entity + domain + topic + reason
- Independent passage controls
- `passage_key = SHA-256(manuscript_id + manuscript_version_id + evidence_identity)`
- `evidence_identity = locator + SHA-256(normalized excerpt)`
- Actions: Not an issue · Needs fix
- `needs_fix.future_consumption = editorial_roadmap_work_item`
- Migration `0029` is committed and **not applied**. Future LSB persistence must not assume it is live.

**Not an issue** ≠ proved equivalent. **Needs fix** ≠ manuscript edit and ≠ confirmed contradiction.

One passage marked Not an issue does not hide remaining passages.

---

## 9. Incremental update and final audit

### Incremental

On chapter revision:

1. Mark evidence derived from changed text stale.
2. Reconsider Bible states that depend on stale evidence.
3. Reconsider continuity findings that depend on stale evidence.
4. Keep unchanged evidence stable where hashes and identities still match.
5. Keep author decisions stable when their `evidence_identity` still matches.
6. Reopen review when evidence identity changes.

Accuracy outranks cost. If dependency safety cannot be proved, re-analyze the affected closure — not necessarily the entire book, but never less than the unsafe set.

### Final audit

A completed book receives a whole-manuscript continuity audit even if it was ingested chapter by chapter.

The audit must be able to detect:

- long-range contradictions
- flashback chronology errors
- cross-chapter state conflicts
- unresolved temporal ambiguity
- knowledge-before-learning
- impossible travel
- object continuity
- relationship drift
- alive/dead chronology
- other governed continuity risks

Reuse established Bible evidence/state where still valid. Do not discard the Bible and start from a blank model.

---

## 10. Series Bible

```
Book Living Story Bible → Series Bible
```

The Series Bible is an inheritance and current-as-of-book view over book Bibles. It is not a second independently extracted universe.

Must support:

- historical states
- current / as-of-book state
- recurring characters, relationships, objects
- timeline and locations
- injuries / history
- roles / ranks / aliases
- author clarification
- unresolved continuity
- intentional retcon

A later book must not silently overwrite prior accepted historical state. Extension is allowed. Intentional revision uses Constitution §7 retcon with provenance.

`lib/canon` `createDraftBibleRevision` / `acceptBibleRevision` already require author or bible_import. Extraction still cannot accept. That gate remains.

---

## 11. Expert consumption

Experts receive purpose-specific **read** views. Reads do not mutate.

| Consumer | Governed view |
|----------|---------------|
| Archivist | Full continuity history, unresolved state, temporal context, author clarifications, review-recommended cards |
| Military Expert | Mission-time rank, injuries, capabilities, equipment, location |
| Police Expert | Event-time location, possession, legal/procedural context |
| Mob Expert | Event-time relationships, allegiance, location |
| Psychologist | Relationship / knowledge / trauma history as relevant |
| Developmental Editor | Timeline, flashbacks, knowledge progression — **see design-vs-consumption boundary below** |
| Literary Agent | High-level unresolved continuity / readiness — not raw canon internals |
| Editor-in-Chief | Governed synthesis view; no generated specialist judgments |

Any proposed mutation uses the authority path for that layer (author promotion, clarification, retcon, or review decision). Downstream contract in `experts/archivist/downstream-canon.ts` remains `role: "reader"`.

Literary Agent must not receive raw Bible internals as if they were commercial findings.

**Developmental Editor boundary.** Design and calibration work for the Developmental Editor MAY begin before the entire Living Story Bible runtime is complete. A Developmental Editor **production** capability that consumes Living Story Bible story-state MUST NOT depend on that state until the minimum governed read contract and required LSB foundations (immutable versions, chapter identity, converged working-state schema, temporal anchors/state histories, and fixtures LSB-T1–T12) are implemented and tested. This package does not implement the Developmental Editor.

---

## 12. Correction workflow contract

Future path — **not implemented now**:

```
continuity issue
  → Needs fix
    → editorial roadmap work item
      → affected passage(s)
        → optional suggested correction
          → author chooses Accept / Edit suggestion / Fix myself
            → new manuscript or chapter revision
              → old evidence becomes historical / stale as appropriate
                → affected analysis reruns
                  → issue resolves or reopens
```

The AI must not silently rewrite authoritative manuscript content.

Phase 1 already records `future_consumption = editorial_roadmap_work_item`. This framework binds that token to Constitution §9 Revision Board and the Editorial Roadmap Framework without implementing either.

---

## 13. Print / export

Author-facing reports and the Living Story Bible should eventually support Print, Save as PDF, and Export.

This is **not** LSB core runtime. It attaches through platform capability `cap.report_exports`. Do not rebuild export independently for every expert.

---

## 14. Deterministic future fixtures

These cases are required before story-state consumption is considered compliant. They are design fixtures, not a license to inspect held-out Rule 8 cases.

| ID | Case | Required outcome |
|----|------|------------------|
| LSB-T1 | Cole 2011 wound vs Cole 2026 wound | Separate temporal states. No contradiction merely from body region. |
| LSB-T2 | Same event/time + incompatible injury facts | Continuity comparison may proceed. |
| LSB-T3 | New York 2019 → Tel Aviv 2026 | Valid state transition when times are established. |
| LSB-T4 | Chapter 20 flashback to 2011 after Chapter 19 in 2026 | Story chronology wins. Chapter order is not the clock. |
| LSB-T5 | Dead → later alive in incompatible story chronology | Continuity concern. |
| LSB-T6 | Relative time without exact date | No false precision. |
| LSB-T7 | Author chronology clarification | Usable and labeled AUTHOR-SUPPLIED. |
| LSB-T8 | Chapter revision changes year | Dependent temporal state reconsidered. |
| LSB-T9 | Unchanged chapter across manuscript revision | Stable chapter identity and evidence where hashes match. |
| LSB-T10 | Later book attempts to overwrite prior accepted historical state | Governed conflict / retcon path. Not silent overwrite. |
| LSB-T11 | Unknown temporal relationship, same entity + topic | Fail closed. No invented contradiction or event split. |
| LSB-T12 | 2026 residual ache from 2011 wound | 2026 state referencing 2011 event. Not a 2011 rewrite. |

LSB-T1–T12 are necessary but not sufficient for series-ready claims. Series readiness additionally requires **LSB-S1** below.

### LSB-S1 — Clean two-book series acceptance test

**Purpose.** Prove the Living Story Bible works on a real multi-book series, not only deterministic fixtures.

**Acceptance series.** Hold Fast. Book 1 = The Reckoning. Book 2 = No Mercy.

**Isolated new series test state.** "Clean" means that test series has no prior manuscripts, no prior Living Story Bible state, and no prior continuity decisions. It does **not** mean delete historical StoryDNA calibration data, delete unrelated manuscript uploads, destroy historical evaluations, or clean the development database indiscriminately. Existing Reckoning calibration artifacts (including official workflows `8911acab`, `b30594ca`, `da1cb4fb`, and REVISED-13 `293c23d7`) must not be mutated or reused as LSB-S1 series state.

**Do not run LSB-S1 until the gate in this section is met.**

Required sequence:

1. Create isolated Hold Fast series test state.
2. Upload The Reckoning as Book 1.
3. Establish an immutable manuscript version.
4. Identify stable chapters.
5. Process the manuscript into the Book 1 Living Story Bible.
6. Establish temporal / state history where supported.
7. Complete Book 1 continuity review.
8. Preserve author decisions and clarifications with provenance.
9. Upload No Mercy as the same series, Book 2, following The Reckoning, with prior-volume authority source = The Reckoning.
10. No Mercy must not be treated as an unrelated manuscript.
11. Book 2 analysis must consume the governed Book 1 story-state / canon view.
12. Cross-book continuity must evaluate appropriate domains, including character identity, aliases, relationships, injuries/history, alive/dead, locations, roles/ranks, knowledge, recurring objects, possessions, chronology, temporal state, organizations/allegiances, and other governed continuity domains.
13. Legitimate state evolution must not become a contradiction merely because the value changed. Book 1 historical state and Book 2 later state may both be true.
14. Story time must govern continuity. Narrative or book order alone must not create chronology.
15. Prior Book 1 historical state must not be silently overwritten by Book 2.
16. A genuine incompatible Book 2 claim against established prior-volume authority must enter the governed continuity-review / conflict path.
17. Unknown cross-book temporal relationship must fail closed.
18. Author clarification must remain labeled author-supplied.
19. Needs Fix must remain editorial state, not canon.
20. Not an Issue must remain review state, not factual equivalence.
21. At completion StoryDNA must be capable of presenting: Book 1 Living Story Bible; Book 2 Living Story Bible; Series Bible; historical state across both books; unresolved cross-book continuity issues; Needs Fix items; author clarifications; evidence provenance back to relevant passages.
22. The test must record: exact manuscript versions; chapter identities; provider/model if AI is used; token usage; cost; runtime; coverage; continuity findings; false positives; false negatives against known benchmark items; author-review outcomes.
23. The acceptance test must not be run until the gate below exists.

**LSB-S1 gate — required before the test is meaningful**

| Capability | Required to run LSB-S1? |
|------------|-------------------------|
| Immutable manuscript versions | **Yes** |
| Stable chapter identity | **Yes** |
| Dual-ingestion convergence onto one Bible schema | **Yes** (Mode A write path is sufficient; Mode B UI is not required) |
| Living Story Bible working-state schema | **Yes** |
| Temporal anchors / state histories | **Yes** |
| Governed prior-volume read | **Yes** |
| Continuity review (Phase 1 passage-level surface from `29a3a620`, wired to LSB evidence) | **Yes** |
| Series Bible projection (Book 1 / Book 2 / series views) | **Yes** |
| Incremental invalidation | No — full affected-set re-run is acceptable |
| Author-clarification UI beyond provenance-capable storage | No — storage + provenance label is enough |
| Productized final-audit UX | No — Book 1 continuity review in the sequence is enough |
| Correction workflow | No |
| Broader expert consumption (Military, Police, Mob, DE production) | No |
| Print / Save as PDF / Export | **No** |

LSB-S1 does not authorize a paid run, a provider call, or reuse of consumed authorizations. A future execute task must authorize cost separately.

---

## 15. What runtime implementations are forbidden

See the [Runtime Contract](./STORYDNA_LIVING_STORY_BIBLE_RUNTIME_CONTRACT.md). Summary:

- overwrite analyzed `manuscript_versions`
- treat chapter number as story time
- upgrade temporal precision
- invent event IDs from region/locator/chapter/year
- redefine `story_dna` as LSB
- auto-accept working state as canon
- treat Not an issue as equivalence
- treat Needs fix as a confirmed contradiction or manuscript edit
- let expert reads mutate the Bible
- rewrite historical evaluations
- apply migrations from documentation
- isolate a second Bible for Mode B

---

## 16. Implementation order

Recommended sequence (detail in the PRD):

1. Immutable manuscript versions
2. Stable chapter identity
3. Dual-ingestion convergence onto that model
4. Working story state + temporal anchors + state history
5. Incremental invalidation
6. Author clarification
7. Final audit
8. Series Bible inheritance
9. Correction workflow
10. Broader expert consumption
11. Print / export via `cap.report_exports`

Must-build-before-next-expert-that-consumes-story-state vs later work is in the PRD.
