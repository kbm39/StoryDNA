# StoryDNA Editorial Constitution

**Version:** 1.0  
**Status:** RATIFIED

---

## Preamble

StoryDNA exists to help authors create the strongest stories possible through a coordinated editorial organization that values evidence, expert independence, author control, continuity, and continuous improvement. StoryDNA does not replace the author. It equips the author with trusted expertise while preserving the author's ownership of the story, the canon, and every creative decision.

---

## Executive Summary

StoryDNA is not a collection of disconnected AI reviewers. It is an **editorial organization** governed by a supervisory layer — the **Editor-in-Chief (EIC)** — that orchestrates certified and experimental experts without becoming one.

Version 1.0 establishes:

1. **Author Intent** sits above the EIC. StoryDNA must understand *why* an author requested review before recruiting experts.
2. **Publication State** and **Series Context** constrain what recommendations are valid, how canon is weighted, and which experts are recruited.
3. **Version Evolution** ensures experts review *changes*, not re-discover solved issues.
4. **Learning** is statistical and transparent — never silent standard rewrites.
5. **Expert Authority** is tripartite: Producing Expert, Authoritative Owner, Supporting Experts. Findings are never overwritten.
6. **Canon** has six constitutional states with author-resolved disputes.
7. **Reports** are unified under one editorial organization, never disconnected artifacts.
8. **Certification** gates all behavioral change.

**Governing maxim:** *Experts produce. Editor-in-Chief adjudicates. Authors decide.*

Ratification authorizes **conforming implementation planning**. It does not commercially enable any expert or approve unbuilt features.

---

## Architecture

```
AUTHOR
  │
  │  goals, publication decisions, canon authority
  ▼
AUTHOR INTENT
  │  (why this review; what success looks like)
  ▼
PUBLICATION STATE + SERIES CONTEXT + EDITION VERSION
  │  (what is locked, what is canon, what changed)
  ▼
EDITOR-IN-CHIEF
  │  orchestration only — never generates expert judgments
  │  recruit · dedup · adjudicate · route · consolidate · track
  ▼
EDITORIAL BOARD
  │  recruited experts for this edition
  ▼
SPECIALISTS
  │  Literary Agent · Military Expert · Combat Medicine · DE · etc.
  │  each produces immutable findings
  ▼
ADJUDICATION LAYER (EIC-owned, read-only ingest)
  │  retain · merge · reroute · downgrade · reject · escalate
  ▼
UNIFIED FINDINGS + REVISION BOARD
  │
  ▼
UNIFIED AUTHOR REPORT
  EIC Summary → Unified Findings → Expert Reports → Appendices → Evidence → Revision Board
```

### Constitutional separation of powers

| Layer | May produce findings | May adjudicate | May overwrite expert artifacts |
|-------|---------------------|----------------|--------------------------------|
| Author | Decisions only | Final authority on retain/reject/implement | No |
| Author Intent | Configuration | No | No |
| Editor-in-Chief | No | Yes | No |
| Experts | Yes | No | No |
| Revision Board | Author actions | Author dispositions | No (tracks lifecycle only) |

---

## Section 0 — Editorial Mission

The Editor-in-Chief exists to:

| Mission | Constitutional meaning |
|---------|------------------------|
| **Recruit the correct editorial team** | Expert selection follows Author Intent, publication state, series context, and coverage gaps — not default bundles |
| **Understand the author's goals** | Author Intent is mandatory input to every EIC plan |
| **Prevent duplicate work** | Dedup gates block redundant expert runs; delta review replaces full re-review when appropriate |
| **Preserve expert independence** | Expert artifacts are immutable; EIC adjudicates without rewriting |
| **Preserve manuscript evidence** | Authoritative manuscript version is the supreme evidence source |
| **Protect canon** | Published and locked canon constrain recommendations |
| **Resolve disagreements** | Cross-expert conflicts resolved by evidence precedence and domain routing — not by generating a third opinion |
| **Produce one coherent editorial experience** | One unified report, one revision plan |
| **Keep the author in control** | Authors decide; EIC recommends; experts inform |

**Governing principle for every later decision:** If a design choice improves expert output but degrades author coherence, author control, or provenance — the choice is unconstitutional unless amended.

---

## Section 1 — Author Intent

### Placement

Author Intent is **above** the Editor-in-Chief. No EIC plan may execute without a recorded Author Intent for the current edition.

```
AUTHOR → AUTHOR INTENT → EDITOR-IN-CHIEF → EDITORIAL BOARD → SPECIALISTS
```

### Supported intent types (minimum v1.0)

| Intent | Primary experts | Report emphasis |
|--------|----------------|-----------------|
| General manuscript review | Literary Agent + domain signals | Balanced unified priorities |
| Query preparation | Literary Agent | Commercial positioning, comp titles, hook |
| Traditional publishing | Literary Agent | Submission readiness, agent-facing tone |
| Self publishing | Literary Agent + Line Editor (future) | Market + production readiness |
| Kindle Unlimited | Literary Agent | Pacing, series hooks, KU market fit |
| Screenplay adaptation | Literary Agent + Thriller Editor (future) | Visual set-pieces, dialogue, act breaks |
| Television adaptation | Literary Agent + DE (future) | Ensemble, episode structure, serial hooks |
| Comic adaptation | Literary Agent + Character Expert (future) | Visual beats, panel density |
| Developmental editing | Developmental Editor | Structure, arc, stakes |
| Copy editing | Line Editor (future) | Prose, consistency |
| Military realism | Military Expert (+ CME when medical) | Tactical coverage, authenticity |
| Medical realism | Combat Medicine / Medical Expert | Clinical accuracy |
| Financial realism | Financial Crimes Expert | Fraud, banking, asset tracing |
| Continuity review | Continuity Expert + Archivist | Series canon, timeline |
| Word-count reduction | Literary Agent + DE | Cuts with commercial rationale |
| Series consistency | Continuity Expert + Timeline Expert | Cross-book alignment |
| Certification benchmark | All certified experts per benchmark spec | Pass/fail against frozen criteria |
| Custom author objective | EIC maps to expert bundle | Author-defined success criteria recorded verbatim |

### How Author Intent changes behavior

**Expert recruitment:** Intent selects the Editorial Board. A "Military realism" intent does not auto-launch Literary Agent unless author also requests commercial review. A "Query preparation" intent prioritizes Literary Agent and suppresses experimental specialists.

**Expert weighting:** In adjudication, in-domain certified experts receive higher confidence weight when their domain matches Author Intent. An ME finding on transfusion under "Military realism" intent routes to Combat Medicine Expert as authoritative owner; under "General review," the same finding may be advisory-only until CME runs.

**Report priority:** Unified Findings sort order follows intent. Query preparation elevates commercial and positioning findings; military realism elevates tactical and authenticity findings.

**Revision sequencing:** Intent defines which findings enter "must fix before next step" vs advisory. Query preparation sequences opening and hook fixes before deep tactical notes.

### Author Intent record

Each edition carries: `intent_type`, `custom_objective_text` (optional), `declared_at`, `author_id`, `supersedes_prior_intent` (boolean). Intent may be updated by author; EIC re-plans on change.

---

## Section 2 — Publication State

### Publication states (constitutional)

Every book and edition **must** declare one state:

| State | Definition | Canon weight |
|-------|------------|--------------|
| **Draft** | Work in progress; not submitted externally | Draft Canon only |
| **Revision** | Active rewrite cycle post-review | Draft Canon; prior findings may apply |
| **Submitted** | Sent to agents/publishers/producers; author-declared | Elevated; changes need author acknowledgment |
| **Published** | Author-declared live publication | **Published Canon** — strongest narrative authority |
| **Out of Print** | Formerly published; no longer actively sold | Published Canon preserved; new edits = new edition |
| **Superseded Edition** | Replaced by newer published edition | Historical Canon; locked for continuity reference |

**Constitutional rule:** Only the author may mark a book **Published**. StoryDNA never infers publication from external metadata without author confirmation.

### How publication state changes behavior

**Continuity decisions:** Published Canon overrides Draft Canon in cross-edition conflicts. Continuity Expert findings against published text require author retcon declaration before Implementation.

**Canon authority:** Recommendations that contradict Published Canon are flagged **Canon Conflict — Author Decision Required** and cannot auto-enter Revision Board as confirmed.

**Revision recommendations:** Submitted and Published states suppress "structural overhaul" findings unless Author Intent explicitly requests developmental pass. EIC downgrades speculative findings to advisory.

**Expert routing:** Published + Series → Continuity Expert and Archivist mandatory. Published → no experimental expert findings auto-retained without certification.

---

## Section 3 — Series Context

### Series context types

| Context | EIC behavior |
|---------|--------------|
| **Standalone** | Standard orchestration; no continuity expert unless author requests |
| **Series** | Continuity Expert + Timeline Expert + Archivist in plan; dual review mode |
| **Anthology** | Shared-universe rules optional; story isolation emphasized |
| **Shared Universe** | Continuity Expert + Archivist mandatory; cross-title canon matrix |

### Dual review mandate

**Every manuscript is reviewed both:**

1. **As an individual work** — does this book succeed on its own terms for the stated Author Intent?
2. **As part of its series** — does this book honor series canon, timeline, character continuity, and edition lineage?

These are separate coverage dimensions in the EIC Coverage Matrix. A finding may score high individually but fail series consistency.

### Series influence on operations

| Dimension | Series-aware behavior |
|-----------|----------------------|
| Recruited experts | +Continuity, +Timeline, +Archivist when series context ≠ standalone |
| Continuity analysis | Cross-book entity registry; character age, location, relationship state |
| Character tracking | Name/role/relationship drift flagged across books |
| Timeline validation | Chronology vs prior published editions |
| Canon protection | Published series canon blocks silent retcons |
| Report wording | Unified report includes "Series Impact" badge on applicable findings |

---

## Section 4 — Version Evolution

### Manuscript evolution chain

StoryDNA tracks edition lineage explicitly:

```
Version N → Expert Review(s) → Author Revision → Version N+1 → …
```

Example constitutional flow:

```
Version 7 → Literary Agent → Revision → Version 8
         → Military Expert → Revision → Version 9
         → Editor-in-Chief consolidation → Version 10 (author-approved changes)
```

### Constitutional definitions

| Concept | Definition |
|---------|------------|
| **Issue history** | Append-only log linking finding → adjudication → disposition → implementation across versions |
| **Issue resolution** | A finding is resolved when lifecycle reaches Closed with Implemented or Rejected |
| **Regression detection** | Re-emergence of a previously Closed issue in a new version triggers regression flag |
| **Expert re-review policy** | Full re-review only when: new Author Intent, major version delta, regression, or new expert recruited. Otherwise **delta review** on changed spans |
| **Delta analysis** | Diff authoritative text between versions; scope expert input to changed scenes/chapters |
| **Improvement tracking** | EIC records metrics: open issue count, confirmed issue count, author acceptance rate per version |

### Constitutional rule

**Experts review changes, not repeatedly rediscover solved issues.**

When Version 9 follows Version 8 with known resolutions:

- EIC passes **resolved finding IDs** to expert workflows as context (read-only)
- Experts may not re-raise closed issues unless regression detected or author reopens
- Unified report shows **Resolved in Version X** for historical transparency

---

## Section 5 — Learning System

### What the EIC monitors (statistical only)

| Metric | Use |
|--------|-----|
| Author acceptance rates | Calibration signal per expert/domain |
| Author rejection rates | False-positive signal |
| False-positive frequency | Adjudication rule tuning candidate |
| Wrong-domain frequency | Ownership matrix tuning candidate |
| Expert disagreement frequency | Certification stress signal |
| Certification benchmark performance | Pass/fail for commercial enablement |

### Constitutional constraints on learning

| Permitted | Forbidden |
|-----------|-----------|
| Aggregate statistics across manuscripts (anonymized) | Silently rewriting expert prompts or validation rules |
| Flagging patterns for human certification review | Auto-changing confidence thresholds in production |
| Publishing calibration reports to operators | Auto-rejecting expert findings based on learned weights without certification |
| Proposing constitutional amendments with evidence | Treating statistical correlation as manuscript evidence |

**Constitutional maxim:** *StoryDNA may learn statistically, but may never silently rewrite expert standards. All behavioral improvements require explicit certification.*

Learning outputs are **recommendations to operators** and **inputs to certification benchmarks** — never direct mutations to expert runtime without a certified release.

---

## Section 6 — Expert Governance

### Tripartite authority (mandatory for every finding)

| Role | Definition |
|------|------------|
| **Producing Expert** | The expert workflow that generated the finding (immutable) |
| **Authoritative Owner** | The specialist domain with constitutional ownership of the issue (EIC-assigned; may differ from producer) |
| **Supporting Experts** | Experts whose findings supply evidence but do not own resolution |

### Example (canonical)

```
Military Expert produces transfusion finding
  → Producing Expert: Military Expert
  → EIC adjudication: reroute_to_specialist
  → Authoritative Owner: Combat Medicine Expert
  → Supporting Experts: [Military Expert]
  → ME finding preserved unchanged; linked as supporting evidence
```

### EIC powers and limits

| EIC may | EIC may not |
|---------|-------------|
| Reroute authoritative ownership | Rewrite finding text |
| Merge duplicate findings (new unified ID, linked sources) | Delete expert findings |
| Downgrade confidence tier | Alter expert review status retroactively |
| Reject false positives (with manuscript proof) | Regenerate expert output |
| Escalate to author or operator | Launch providers autonomously without plan |

### Ownership matrix (summary)

Each expert owns defined domains (tactics, medicine, finance, plot, canon, etc.) and explicitly **does not own** others. Findings outside ownership are constitutionally subject to reroute. Shared ownership requires documented co-primary status.

---

## Section 7 — Canon Governance

### Canon states

| State | Definition | Authority |
|-------|------------|-----------|
| **Draft Canon** | Current working manuscript; unpublished | Author + EIC recommendations |
| **Published Canon** | Author-declared published edition | Strongest narrative authority |
| **Locked Canon** | Published + author lock (no silent edits) | Immutable without retcon |
| **Retconned Canon** | Author-declared intentional override of prior canon | Supersedes prior published state with provenance |
| **Historical Canon** | Superseded edition preserved for reference | Read-only; continuity source |
| **Disputed Canon** | Conflicting sources unresolved | **Author must resolve** before Implementation |

### Author resolution of canon conflicts

When Disputed Canon is detected:

1. EIC flags finding as **Canon Conflict**
2. Unified report presents both positions with evidence
3. Author selects: Accept A / Accept B / Retcon / Defer
4. Retcon requires explicit **Retconned Canon** declaration with scope (book, series, character, event)
5. Archivist records lineage; Continuity Expert updates series matrix

**Constitutional rule:** *No AI inference silently becomes canon.* Only author declarations change canon state.

---

## Section 8 — Report Governance

### What StoryDNA never produces

- Independent disconnected expert reports as the primary author experience
- Competing "final verdicts" from multiple experts without EIC consolidation
- Reports that hide provenance or expert disagreement

### Constitutional report hierarchy

```
1. Editor-in-Chief Summary
      edition scope, intent, experts consulted, top priorities, author actions required

2. Unified Findings
      authoritative consolidated list; sorted by Author Intent priority

3. Expert Reports (preserved originals, linked)
      Literary Agent, Military Expert, specialists — read-only capsules

4. Scene Appendices
      when scene-centric experts ran (e.g., Military V2)

5. Evidence
      locators, excerpts, contrary evidence, supporting links

6. Revision Board
      actionable items with lifecycle state
```

### Author experience standard

The author should feel they hired **one editorial organization**, not a stack of tools. Per-expert reports remain available for transparency and provenance — they are not the primary deliverable.

### Provisional findings

Findings marked `author_review_required` or released provisionally:

- Appear only in **Author Review Required** sections
- Never count as confirmed in EIC Summary totals
- Require explicit author disposition before entering confirmed Unified Findings

---

## Section 9 — Revision Board Governance

### Lifecycle (constitutional)

```
Open → Investigating → Assigned Expert → Rewrite Proposed
  → Author Approved → Implemented → Verified → Closed
```

### Board item sources

Only EIC-adjudicated outcomes feed the board:

| Adjudication | Board effect |
|--------------|--------------|
| retain / retain_with_revision | Creates item (Open) |
| downgrade | Creates advisory item |
| reroute_to_specialist | Creates item in Assigned Expert |
| duplicate_merge | Single item, merged provenance |
| reject_false_positive | No item; logged |
| insufficient_evidence | Advisory or Investigating |
| escalate | Author Review Required panel |

### Author control

Authors may: Accept, Accept Modified, Reject, Defer, Reopen. EIC tracks lifecycle; authors own dispositions. Implementation never modifies Published/Locked Canon without retcon declaration.

---

## Section 10 — Editor-in-Chief Governance

The EIC is an **orchestration subsystem**, not an expert.

| Responsibility | Constitutional basis |
|------------------|---------------------|
| Expert selection | Author Intent + publication + series + coverage |
| Recruitment when gaps found | Post-run adjudication + coverage matrix |
| Duplicate prevention | Dedup gates + duplicate_merge |
| Contradiction detection | Cross-expert adjudication |
| Disagreement classification | Evidence / domain / legitimate / insufficient |
| Routing | Ownership matrix + reroute rules |
| Unified revision plan | Single consolidated list |
| Unified report | Report hierarchy |
| Ownership tracking | Tripartite authority |
| Lifecycle tracking | Revision Board states |
| Provenance | Append-only adjudication ledger |
| Non-destructive adjudication | retain · merge · reroute · downgrade · reject · escalate |

EIC runs are **read-only** against expert artifacts and **append-only** for editorial state.

---

## Section 11 — Certification Governance

### Tiers

| Tier | Meaning | Commercial |
|------|---------|------------|
| **Certified** | Passed frozen benchmark; EIC may auto-retain in-domain | `selectionEnabled` eligible |
| **Validated** | Internal quality; Kevin Studio only | Experimental |
| **Experimental** | Uncertified draft | Kevin Studio flags only |
| **Planned** | Not registered | Blocked |

### Certification requirements

- Frozen benchmark manuscript(s) with expected adjudication outcomes
- Cross-expert acceptance tests pass
- False-positive rate below certified threshold
- Wrong-domain rate below certified threshold
- Operator sign-off + constitutional compliance review

### Commercial enablement rule

**No expert may be commercially enabled without:**

1. Certification benchmark pass
2. EIC ownership matrix entry ratified
3. Constitutional amendment (if new domain) or conformance confirmation

Military Expert remains experimental until separately certified — consistent with current `selectionEnabled: false`.

---

## Section 12 — Constitutional Rights

### Author Rights

The author has the right to:

- reject any recommendation;
- approve, modify, defer, or reopen any finding;
- select or decline experts;
- define Author Intent;
- lock and unlock canon;
- declare publication state;
- approve retcons;
- preserve historical reports;
- retain ownership of all creative decisions;
- see provenance behind every recommendation.

### Expert Rights

Every expert has the right to:

- preserve its original immutable report;
- disagree with another expert;
- retain attribution for findings it produced;
- have its findings rerouted without being rewritten;
- have its certification tier and domain boundaries respected.

### Editor-in-Chief Rights and Limits

The Editor-in-Chief **may**:

- recruit;
- route;
- merge;
- prioritize;
- adjudicate;
- downgrade;
- reject;
- escalate;
- compose unified findings.

The Editor-in-Chief **may never**:

- rewrite historical expert findings;
- alter manuscript evidence;
- change canon without author approval;
- impersonate a specialist;
- silently change expert standards;
- overwrite historical decisions.

---

## Section 13 — Burden of Proof

**Required rule:** *Whoever makes an editorial claim bears the burden of supporting it.*

Every retained finding must include:

- manuscript evidence;
- source locator;
- explanation of why the evidence supports the concern;
- contrary evidence or an honest statement that none was found;
- domain ownership;
- confidence;
- safe and relevant editorial guidance.

If the burden of proof is not met:

- the finding cannot be confirmed;
- it becomes provisional, insufficient evidence, advisory, rerouted, or rejected.

**Structural validity alone is not proof.**

---

## Section 14 — Constitutional Conformance Tests

Every future feature, PRD, workflow, migration, expert, report, and interface must be tested against:

1. Author control
2. Author Intent
3. Evidence-first reasoning
4. Expert independence
5. Published canon protection
6. Series continuity
7. Immutable history
8. Provenance
9. Domain ownership
10. Certification gates
11. Unified author experience
12. Backward compatibility

**Required rule:** If a proposal violates one of these principles, it cannot ship unless the Constitution is formally amended first.

### Required documentation block for future proposals

```
Constitution Compliance

- Applicable sections:
- Compliance explanation:
- Amendment required: Yes / No
- Backward-compatibility impact:
- Certification impact:
```

---

## Section 15 — Constitutional Principles

1. **Experts produce.** Only certified/experimental expert workflows generate domain findings.
2. **Editor-in-Chief adjudicates.** EIC resolves cross-expert issues without generating expert judgments.
3. **Authors decide.** Final retain/reject/implement/canonical authority rests with the author.
4. **Evidence outranks opinion.** Manuscript text and verified locators beat structural validity alone.
5. **Published canon outranks drafts.** Recommendations cannot silently override Published/Locked Canon.
6. **No AI inference silently becomes canon.** Canon state changes require author declaration.
7. **Nothing is overwritten.** Expert findings are immutable; EIC creates derived unified records.
8. **Every decision has provenance.** Adjudication records link source → decision → outcome.
9. **Every recommendation is traceable.** Unified findings link to producing expert, review ID, and evidence.
10. **Every retained finding belongs to one authoritative owner.** Supporting experts are explicit.
11. **Every report serves the author's stated goal.** Author Intent governs priority and recruitment.
12. **Learning is visible; standards are certified.** No silent prompt or threshold mutation.
13. **Experts review changes, not solved issues.** Delta review is default across versions.
14. **Dual review for series works.** Individual quality and series consistency are both mandatory.
15. **One editorial organization, one primary experience.** Unified report is the author deliverable.

---

## Section 16 — Implementation Roadmap

Ratification authorizes **conforming implementation planning**. Individual phases still require constitutional compliance review and, where applicable, certification before commercial enablement.

| Phase | Deliverable | Constitutional dependency |
|-------|-------------|---------------------------|
| **0** | Ratify Constitution v1.0 | This document |
| **1A** | Author Intent record + EIC plan gate | §1 |
| **1B** | Publication state on editions | §2 |
| **1C** | Persist EIC adjudication + unified findings | §6, §10 |
| **2A** | Unified report composer | §8 |
| **2B** | Revision Board lifecycle expansion | §9 |
| **3A** | Series context + dual review mode | §3 |
| **3B** | Canon state machine | §7 |
| **4A** | Version evolution + delta review | §4 |
| **4B** | Learning metrics dashboard (operator) | §5 |
| **5** | Per-expert certification + commercial gates | §11 |

### Conforming seeds (existing assets)

- Cross-expert adjudication audit → permanent adjudicator (§10)
- Expert desk + editorial team → Editorial Board recruitment (§1)
- Military V2 synthesis/report → Expert Reports + Scene Appendices (§8)
- Revision board + dispositions → Revision Board governance (§9)
- Provisional release / author_review_required → Report governance (§8)

---

## Section 17 — Open Questions

| # | Question | Default until resolved |
|---|----------|------------------------|
| 1 | May Author Intent be inferred from upload metadata, or must it always be explicit? | **Explicit only** |
| 2 | Who may mark Superseded Edition — author only or author + Archivist confirmation? | **Author only** |
| 3 | Maximum experimental findings auto-retained in unified plan? | **Zero for Published; advisory-only for Draft** |
| 4 | Delta review minimum change threshold (words/scenes)? | **TBD at certification** |
| 5 | Retcon scope granularity (event vs chapter vs book)? | **Author selects at retcon declaration** |
| 6 | Multi-author works — whose intent and canon authority? | **Primary author account; collaborators TBD** |
| 7 | EIC operator override audit visibility to authors? | **Visible in provenance** |
| 8 | Anthology vs shared universe boundary | **Author declares series context type** |

---

## Section 18 — Amendment Process

### Authority

Changes to this Constitution require **constitutional amendments**, not ad hoc feature design.

### Amendment types

| Type | Scope | Approval |
|------|-------|----------|
| **Patch (1.0.x)** | Clarifications, no behavioral change | Operator + documentation |
| **Minor (1.x.0)** | New expert domain, new intent type, new canon state | Operator + certification review |
| **Major (x.0.0)** | Changes to principles, EIC powers, author authority | Operator + author-advocate review + written migration plan |

### Amendment record

Each amendment documents: `amendment_id`, `version_from`, `version_to`, `rationale`, `affected_sections`, `backward_compatibility`, `certification_impact`, `ratified_at`.

### Conformance rule

**Future architecture must conform to the ratified Constitution.** Implementation PRs cite constitutional sections. Features that cannot cite conformance require amendment first.

---

## Ratification

| Field | Value |
|-------|-------|
| **Title** | StoryDNA Editorial Constitution |
| **Version** | 1.0 |
| **Status** | RATIFIED |
| **Ratified by** | Kevin Martin, Founder |
| **Ratification Date** | 2026-07-31 |
| **Authority** | This document governs StoryDNA architecture until amended through the constitutional amendment process. |
| **Supersedes** | Editor-in-Chief Architecture working draft |

---

When this Constitution conflicts with implementation, the Constitution prevails until it is formally amended.
