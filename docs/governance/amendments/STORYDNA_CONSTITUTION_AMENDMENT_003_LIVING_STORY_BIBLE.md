---
no_new_capability: false
rationale: Constitutional amendment establishing the Living Story Bible as a platform-wide story-state capability.
---

# StoryDNA Editorial Constitution Amendment 003

## Living Story Bible and Dual Ingestion Principle

**Amendment ID:** `STORYDNA_CONSTITUTION_AMENDMENT_003`  
**Constitutional version:** 1.3.0 amendment (supplements v1.0 + Amendment 001 + Amendment 002)  
**Status:** RATIFIED  
**Effective date:** 2026-09-27  
**Supplements:** [StoryDNA Editorial Constitution v1.0](../STORYDNA_EDITORIAL_CONSTITUTION_V1.0.md), [Amendment 001](./STORYDNA_CONSTITUTION_AMENDMENT_001_CAPABILITY_PROPAGATION.md), [Amendment 002](./STORYDNA_CONSTITUTION_AMENDMENT_002_PROGRESSIVE_EDITORIAL_UNDERSTANDING.md)

This amendment does **not** replace or rewrite Constitution v1.0, Amendment 001, or Amendment 002.

## Constitution Compliance

```json
{
  "applicable_sections": [
    "§0",
    "§2",
    "§3",
    "§4",
    "§7",
    "§9",
    "§12",
    "§13",
    "§14",
    "§15",
    "Amendment 001",
    "Amendment 002"
  ],
  "compliance_explanation": "Amendment 003 adds a platform story-state system under existing author authority, evidence-first, fail-closed, and immutable-history principles. It refines §3 series continuity, §4 version evolution, and §7 canon governance without renaming Draft/Published/Locked/Historical/Retconned/Disputed Canon. Author clarification inherits Amendment 002 framing-versus-evidence. Capability classification is platform_wide under Amendment 001.",
  "amendment_required": "Yes",
  "backward_compatibility_impact": "Additive governance only until a dedicated runtime task ships. Current manuscript_versions overwrite, Reckoning-locked chapter parsing, story_dna blobs, and lib/canon TemporalScope-as-chapter-number remain non-compliant with this amendment and must not be silently redefined. Historical Archivist evaluations are not rewritten.",
  "certification_impact": "No expert is commercially enabled by this amendment. Future LSB runtime requires deterministic fixtures LSB-T1–T12 before any expert may consume story-state. Series-ready claims additionally require isolated two-book acceptance test LSB-S1 after its Framework gate."
}
```

## Capability Propagation Review

```json
{
  "new_capability_introduced": "Living Story Bible (cap.living_story_bible)",
  "existing_capability_modified": "cap.version_aware_review; cap.series_context; cap.publication_state; cap.report_exports; Archivist Phase 1 review-recommended (commit 29a3a620)",
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
    "psychologist",
    "character_expert"
  ],
  "editor_in_chief_impact": "EIC may compose governed synthesis views. EIC may not author Living Story Bible state by reading it.",
  "platform_impact": "One story-state architecture for complete-manuscript and progressive ingestion. Immutable manuscript versions, stable chapter identity, story time distinct from narrative order, provenance-distinct author clarification.",
  "certification_impact": "Deterministic temporal and ingestion fixtures required before story-state consumption. Print/PDF/export remains cap.report_exports.",
  "propagation_decision": "move_to_platform",
  "review_artifact_path": "docs/governance/capabilities/AMENDMENT_003_CAPABILITY_PROPAGATION_REVIEW.md"
}
```

---

## Preamble

StoryDNA cannot remain a collection of one-shot reports attached to a single overwritten manuscript row.

Authors write complete books and they write chapter by chapter. Both paths must produce the same governed understanding of the story world.

That understanding is the **Living Story Bible**. It is a story-state system grounded in manuscript evidence and author authority. It is not a generated report, not `story_dna`, not model memory, and not accepted canon by default.

This amendment formalizes that capability without weakening Constitution §7 canon states, Amendment 001 propagation, or Amendment 002 framing-versus-evidence.

---

## Core Rule

**StoryDNA must maintain one continuously developing, evidence-backed Living Story Bible for the author's story world across chapter → book → series. Complete-manuscript ingestion and progressive chapter ingestion must converge on that same Bible. Continuity facts are stateful over story time. A later or different established story-time state does not contradict an earlier state merely because subject and topic match. Where the manuscript does not establish temporal relationship, StoryDNA must not invent one.**

---

## Required Principles

### 1. Living Story Bible is a platform story-state system

The Living Story Bible is StoryDNA's governed understanding of the story world. It is **not**:

- a generated report;
- a static Series Bible snapshot;
- the `story_dna` / Story Understanding blob;
- accepted or Published Canon;
- model memory;
- a replacement for the manuscript.

`story_dna` remains a one-shot interpretive discovery product. It must not be silently redefined as the Living Story Bible.

### 2. Dual ingestion, one architecture

StoryDNA must support both:

| Mode | Author action | Requirement |
|------|---------------|-------------|
| **A — Complete manuscript** | Upload a finished manuscript | StoryDNA identifies chapters automatically. The author must not be required to split a completed book. |
| **B — Build as I write** | Add chapters progressively | Each chapter updates the same Living Story Bible. |

Experts must not require separate logic depending on which ingestion mode introduced the text. Downstream architecture is:

```
series → manuscript → immutable manuscript version → stable chapter identity → chapter revision → evidence
```

### 3. Immutable source history

A manuscript revision must not silently overwrite the evidence source used by prior StoryDNA analysis.

Current production behavior that updates the current `manuscript_versions` row in place is **non-compliant** with future Living Story Bible runtime. This amendment prohibits that behavior going forward. It does not authorize a silent runtime fix in this documentation task.

Constitution §4 Version Evolution already requires edition lineage and delta review. This principle supplies the missing source-immutability rule those reviews depend on.

### 4. Chapter identity is first-class

Chapter is a first-class narrative unit. **Chapter identity** and **chapter content revision** are different concepts.

The future runtime must account for chapter added, edited, deleted, moved, renamed, split, and merged. Governance requires deterministic, provenance-preserving handling. Governance does **not** prescribe an unsafe matching algorithm.

The Reckoning-locked heading parser is not general chapter identity.

### 5. Story time is not narrative order

Chapter number, segment order, and manuscript position must never by themselves be treated as fictional chronology.

Chapter 20 may contain a 2011 flashback even if Chapter 19 occurs in 2026. Story chronology wins when established. Narrative order remains a locator property, not a clock.

Constitution §7 and Archivist Constitution Rule E already require temporal reasoning. This amendment forbids treating chapter/scene bounds as story time.

### 6. Temporal precision is preserved

StoryDNA must retain the precision the evidence actually supports.

| Evidence | Permitted precision |
|----------|---------------------|
| March 14, 2026 | exact date |
| November 2011 | month/year |
| 2026 | year |
| early 2026 | approximate |
| three weeks after the bombing | relative |
| during the 2011 deployment | historical-event context |
| before the courthouse attack | sequence-only |
| 2011–2012 | range |
| unknown | unknown |

False precision is forbidden. "November 2011" must not become November 1, 2011. "2026" must not become January 1, 2026. Relative time must not become an exact calendar date unless evidence supports the conversion.

### 7. Unknown time fails closed

If StoryDNA cannot establish the temporal relationship between two facts, it must not invent chronology, automatically declare a contradiction, or automatically declare separate events.

The pair may qualify for author review only if it satisfies governed review-eligibility requirements.

### 8. State-over-time

The Living Story Bible must support histories for time-varying facts. A later state does not erase a historically correct earlier state.

Apply history semantics where justified, including injury, residence/location, relationships, employment/role, rank/title, allegiance/organization, possessions, alive/dead, knowledge, capabilities, and recurring objects.

Do not force history semantics onto inherently stable facts unless justified.

### 9. Event identity is not temporal identity

**Temporal identity** is when something occurred. **Event identity** is which happening it belongs to.

Same year does not mean same event. Same location does not mean same event. Different locations do not necessarily mean different events. Different established years normally establish different temporal states, but residual references remain possible:

> The wound from 2011 still ached in 2026.

That is a 2026 state referring to a 2011 injury event.

StoryDNA must not invent event IDs merely from body region, locator, chapter, scene, or year.

### 10. Authority layers are distinct

Living Story Bible layers are **not** a rename of Constitution §7 publication-canon states (Draft / Published / Locked / Retconned / Historical / Disputed).

At minimum distinguish:

| Layer | Meaning |
|-------|---------|
| **Manuscript evidence** | What the source text actually establishes |
| **Working story state** | StoryDNA's evidence-backed current understanding. Not automatically accepted canon. |
| **Author clarification** | Explicitly author-supplied information. Always retains author provenance. Never falsely represented as manuscript-derived. |
| **Accepted / authoritative canon** | Facts promoted through the appropriate human-authority gate. Constitution §7 states still apply to published/locked editions. |
| **Unresolved continuity question** | Evidence StoryDNA cannot safely adjudicate |
| **Needs-fix editorial issue** | An author decision that something requires attention. Not canon. Not a confirmed contradiction. |

Additional existing distinctions that remain in force:

- Constitution §7 publication-canon states;
- `lib/canon` authority ranks (`author_approved_exception` > `series_bible_accepted` > `prior_volume_canon` > `current_observation` > `inferred` > `uncertain_observation`);
- Amendment 002 `is_manuscript_evidence: false` for conversational framing;
- Archivist Phase 1 engine classification vs author review state (`29a3a620`).

Working story state is not Draft Canon. Author clarification is not manuscript evidence. Needs Fix is not Disputed Canon.

### 11. Author clarification is first-class and provenance-distinct

Example:

> The first Cole wound happened in 2011. The wash ambush is in 2026. They are separate injuries.

StoryDNA may use that clarification in later reasoning. It remains labeled **AUTHOR-SUPPLIED** unless separately promoted to authoritative canon.

Clarification must support creation, provenance, revision, supersession, and audit history. Prior clarification history is not erased.

This is the story-state application of Amendment 002 Principle 6 (framing versus evidence). It does not replace Editorial Understanding.

### 12. Continuity review is evidence-level and distinct from diagnosis

Commit `29a3a620` (`feat(archivist): add passage-level continuity review`) is the incorporated Phase 1 surface:

**Potential continuity issue — review recommended**, with passage-level **Not an issue** and **Needs fix**.

| Decision | Meaning |
|----------|---------|
| **Not an issue** | Author review decision. Does not prove equivalence. Does not automatically create canon. |
| **Needs fix** | Author editorial decision. Does not edit the manuscript. Does not automatically confirm a contradiction. Does not automatically create canon. |

Evidence-level decisions remain separate from engine classification. Cards remain visible; one Not an issue does not dismiss a cluster.

### 13. Incremental update and final audit

When a chapter changes:

- evidence derived from changed text may become stale;
- Bible states and continuity findings depending on that evidence may require reconsideration;
- unchanged evidence and author decisions tied to unchanged evidence remain stable where safe;
- changed evidence may reopen review.

Full-manuscript re-analysis is not required when unaffected dependencies can be safely preserved. Cost optimization must never override accuracy.

Progressive ingestion does **not** eliminate whole-manuscript audit. A completed book should receive a final continuity audit for long-range contradictions, flashback chronology, cross-chapter state conflicts, unresolved temporal ambiguity, knowledge-before-learning, impossible travel, object continuity, relationship drift, alive/dead chronology, and other governed continuity risks.

The final audit should reuse established Living Story Bible evidence/state where safe rather than blindly discarding it. This is the story-state application of Constitution §4 delta review plus the dual-review mandate in §3.

### 14. Series Bible inheritance

```
Book Living Story Bible → Series Bible
```

Prior-book authoritative history must not be silently overwritten by a later book. A later book may extend or intentionally revise canon only through governed authority, including intentional retcon under Constitution §7.

The Series Bible must support historical states, current/as-of-book state, recurring characters, relationships, objects, timeline, locations, injuries/history, roles/ranks, aliases, author clarification, unresolved continuity, and intentional retcon.

### 15. Experts consume; they do not mutate by reading

Experts receive purpose-specific governed read views. Reading must not mutate the Bible. Any proposed mutation must go through the appropriate authority path.

This preserves Constitution §6 expert independence and `experts/archivist/downstream-canon.ts`: consumers are readers.

Print, Save as PDF, and Export remain the existing platform capability `cap.report_exports`. They are not part of Living Story Bible core runtime and must not be rebuilt per expert.

### 16. Historical evaluations are not rewritten

Official historical Archivist evaluations and reports are not rewritten to conform retroactively to this amendment.

### 17. Clean two-book series acceptance is required before series-ready claims

Before StoryDNA may claim Living Story Bible series readiness, it must pass the isolated Hold Fast acceptance test **LSB-S1** (The Reckoning as Book 1 → No Mercy as Book 2) specified in the Living Story Bible Framework.

LSB-S1 must not run until the Framework gate is met. Isolated test state must not destroy historical calibration data, unrelated manuscripts, official evaluations, or the development database indiscriminately.

---

## Relationship to existing governance

| Existing authority | Relationship |
|--------------------|--------------|
| Constitution §3 Dual review | LSB supplies the series-state substrate; dual review remains mandatory |
| Constitution §4 Version Evolution | LSB requires immutable versions and chapter-grain delta; does not rename "experts review changes" |
| Constitution §7 Canon states | Publication/lock/retcon states remain. LSB layers are a different axis. |
| Constitution §9 Revision Board | Needs Fix may later become an editorial roadmap work item; it is not itself a board disposition |
| Amendment 001 | LSB is `platform_wide`; no silent expert-only Bible |
| Amendment 002 | Author clarification and Editorial Understanding stay distinct; both are non-manuscript-evidence until promoted |
| Archivist Constitution A–H | Expert constitution remains. Platform LSB is the story-state those rules protect. Rule E is refined: chapter/scene ≠ story time. |
| `lib/canon` authority ranks | Remain the conflict-ranking model for accepted facts |
| Phase 1 `29a3a620` | Incorporated review surface; not collapsed into canon |
| `story_dna` | Remains interpretive discovery; not LSB |
| `cap.report_exports` | Presentation/export layer; not LSB runtime |

---

## Governance artifacts

| Artifact | Path |
|----------|------|
| Living Story Bible Framework | [STORYDNA_LIVING_STORY_BIBLE_FRAMEWORK.md](../implementation/STORYDNA_LIVING_STORY_BIBLE_FRAMEWORK.md) |
| Living Story Bible PRD | [STORYDNA_LIVING_STORY_BIBLE_PRD.md](../implementation/STORYDNA_LIVING_STORY_BIBLE_PRD.md) |
| Runtime Contract | [STORYDNA_LIVING_STORY_BIBLE_RUNTIME_CONTRACT.md](../implementation/STORYDNA_LIVING_STORY_BIBLE_RUNTIME_CONTRACT.md) |
| Capability Propagation Review | [AMENDMENT_003_CAPABILITY_PROPAGATION_REVIEW.md](../capabilities/AMENDMENT_003_CAPABILITY_PROPAGATION_REVIEW.md) |

---

## Ratification

| Field | Value |
|-------|-------|
| **Title** | Living Story Bible and Dual Ingestion Principle |
| **Amendment** | 003 |
| **Constitutional Version** | 1.3.0 amendment supplementing Constitution v1.0 + Amendment 001 + Amendment 002 |
| **Status** | RATIFIED |
| **Ratified by** | Kevin Martin, Founder |
| **Ratification Date** | 2026-09-27 |
| **Effective Date** | 2026-09-27 |
| **Authority** | This amendment supplements and carries governing authority equal to the ratified StoryDNA Editorial Constitution Version 1.0 and ratified Amendments 001–002. |
| **Core Rule** | One Living Story Bible; dual ingestion converges; story time ≠ narrative order; unknown time fails closed; later states do not erase earlier historically correct states. |
| **Supersedes** | No prior amendment text |

**Ratification does not authorize runtime implementation.** Individual implementation tasks, migrations, provider calls, and historical-artifact rewrites remain separately authorized. Effective governance is **v1.0 + Amendment 001 + Amendment 002 + Amendment 003**.
