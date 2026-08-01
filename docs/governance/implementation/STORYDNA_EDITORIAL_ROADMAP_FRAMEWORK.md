# StoryDNA Editorial Roadmap Framework

**Document type:** Platform architecture design (no runtime implementation)  
**Owner:** Kevin Track / StoryDNA Editorial Organization  
**Branch baseline:** `feature/eic-phase-1a-author-intent`  
**Constitution baseline:** v1.0 + Amendment 001 (RATIFIED)  
**Related artifacts:** [EIC_PHASE_1A_AUTHOR_INTENT_PRD.md](./EIC_PHASE_1A_AUTHOR_INTENT_PRD.md), [STORYDNA_CONVERSATIONAL_INTELLIGENCE_FRAMEWORK.md](./STORYDNA_CONVERSATIONAL_INTELLIGENCE_FRAMEWORK.md), [EIC_CONVERSATIONAL_INTAKE_AND_TEAM_APPROVAL_UX_BLUEPRINT.md](./EIC_CONVERSATIONAL_INTAKE_AND_TEAM_APPROVAL_UX_BLUEPRINT.md)

---

## Constitution Compliance

```json
{
  "applicable_sections": ["§0", "§1", "§6", "§8", "§10", "§12", "§13", "§14"],
  "compliance_explanation": "The Editorial Roadmap implements §0 Editorial Mission by giving the author one coherent answer to 'What do I do next?' — the EIC synthesizes expert outputs into a living strategy without producing expert findings. §1 Author Intent defines Destination; the roadmap measures distance from intent, not from expert preference. §6 Expert Governance is preserved: experts feed the roadmap; they do not own it; tripartite authority and immutable expert artifacts remain unchanged. §8 Report Governance: expert reports and unified findings are inputs to the roadmap, not the primary author experience — the roadmap supersedes disconnected report browsing as the organizing deliverable. §10 EIC Governance: the EIC owns roadmap synthesis, sequencing, and evolution; experts are recruited and sequenced by roadmap logic. §12 Author Rights: authors may reject recommendations, override sequencing, and retain all creative decisions; the roadmap recommends, never mandates. §13 Burden of Proof: every roadmap claim (distance, readiness, next action) must cite manuscript evidence, expert findings, or author-declared intent — structural inference alone is insufficient. §14 conformance tests defined in Section 16. Amendment 001 capability review completed below.",
  "amendment_required": "No",
  "backward_compatibility_impact": "Additive platform layer. Existing expert reports, unified findings, revision board, and EIC editorial plans remain when roadmap flags are off. The roadmap aggregates existing artifacts; it does not replace or rewrite them.",
  "certification_impact": "No expert commercially enabled. Roadmap synthesis is EIC orchestration only. Expert outputs remain subject to existing certification tiers."
}
```

---

## Capability Propagation Review

```json
{
  "new_capability_introduced": "Editorial Roadmap (storydna_editorial_roadmap@v1)",
  "existing_capability_modified": "EIC editorial plan gate; unified report composer (future); revision board prioritization; author Studio home experience",
  "classification": "editor_in_chief_owned",
  "existing_experts_evaluated": ["literary_agent", "military_expert", "developmental_editor", "editor_in_chief"],
  "future_experts_affected": ["line_editor", "character_expert", "continuity_expert", "timeline_expert", "archivist", "combat_medicine_expert", "financial_crimes_expert", "producer", "screenplay_editor"],
  "editor_in_chief_impact": "Primary owner. The EIC synthesizes, maintains, and evolves the Editorial Roadmap after every review, revision, and manuscript version change. The roadmap becomes the EIC's primary author-facing deliverable.",
  "platform_impact": "New central Studio artifact, contract, lifecycle, and author home experience. All expert outputs, intent records, briefs, and adjudication feed the roadmap. Replaces report-first navigation with roadmap-first navigation when enabled.",
  "certification_impact": "No commercial enablement change. Roadmap confidence scores aggregate certified and experimental expert outputs with honest tier labeling.",
  "propagation_decision": "move_to_editor_in_chief",
  "review_artifact_path": "docs/governance/implementation/STORYDNA_EDITORIAL_ROADMAP_FRAMEWORK.md"
}
```

### Sub-capability classifications (reviewed)

| Sub-capability | Classification | Propagation decision | Rationale |
|----------------|----------------|---------------------|-----------|
| Roadmap synthesis engine | editor_in_chief_owned | move_to_editor_in_chief | EIC orchestration; not expert judgment |
| Protected Strengths identification | editor_in_chief_owned | move_to_editor_in_chief | EIC consolidates cross-expert strength signals |
| Editorial Distance model | editor_in_chief_owned | move_to_editor_in_chief | EIC-owned distance estimation from intent |
| Progress dimension scoring | editor_in_chief_owned | move_to_editor_in_chief | Aggregates expert + author signals |
| Next Best Action selection | editor_in_chief_owned | move_to_editor_in_chief | EIC prioritization per §10 |
| Editorial Sequence ordering | editor_in_chief_owned | move_to_editor_in_chief | EIC recruitment and review ordering |
| Milestone tracking | platform_wide | move_to_platform | Cross-cutting author progress artifact |
| Roadmap author UI | platform_wide | move_to_platform | Primary author-facing Studio experience |

---

## 1. Vision

**The Editorial Roadmap is the product.** Experts, reports, and findings are inputs — not deliverables. StoryDNA exists to answer one question for every author at every moment:

> *How do I take this manuscript from where it is today to my publishing goal?*

The author should never wonder "What do I do next?" StoryDNA always answers. Every recommendation on the roadmap moves the author measurably closer to their declared publishing goal.

### Design north star

| The roadmap feels like | The roadmap does NOT feel like |
|--------------------------|--------------------------------|
| A trusted editor's strategic plan for your book | A pile of expert reports to sort through |
| A living editorial strategy that evolves with your work | A static checklist or bug tracker |
| Encouragement grounded in evidence | A list of everything wrong with your manuscript |
| One clear next step with a reason | A task manager with fifty open items |
| Protection of what already works | A revision board of issues to close |

### Primary question

**How does StoryDNA take an author from today's manuscript to tomorrow's publishing goal?**

The roadmap is the permanent answer — updated after every expert review, every accepted or rejected revision, and every manuscript version.

### Architectural placement

```
AUTHOR INTENT + MANUSCRIPT BRIEF
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│  EDITORIAL ROADMAP (the product)                              │
│  Destination · Position · Distance · Strengths · Sequence     │
│  Progress · Milestones · Next Best Action                     │
└───────────────────────────┬───────────────────────────────────┘
                            │ fed by
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
   Expert Reports    Unified Findings    Author Revisions
   Adjudication      Revision Board      Version History
   Conversational    Author Intent       Publication State
   Intelligence      Manuscript Brief
```

**Hard boundary:** The Editorial Roadmap is EIC-synthesized editorial strategy. It is not an expert report, not a finding, and not manuscript evidence. It aggregates and prioritizes; it does not generate specialist judgments.

---

## 2. Roadmap Philosophy

### The roadmap IS

- A **living editorial strategy** — updated after every meaningful event
- The **central organizing principle** of the author Studio experience
- An **encouraging, evidence-grounded plan** — strengths first, then opportunities, then next step
- A **distance model** — measurable progress toward the author's declared goal
- A **protection contract** — what must not be damaged during revision
- A **sequencing engine** — which expert runs when, and why that order

### The roadmap IS NOT

| Not this | Because |
|----------|---------|
| A report | Reports are expert inputs; the roadmap synthesizes them |
| A checklist | Checklists track tasks; the roadmap tracks editorial strategy |
| A task manager | Tasks are implementation detail; the roadmap defines editorial direction |
| A revision board | The revision board tracks finding lifecycle; the roadmap prioritizes editorial work |
| A bug tracker | Issues are expert outputs; the roadmap is author-facing strategy |

### The eight questions (mandatory)

Every roadmap version must answer:

| # | Question | Roadmap section |
|---|----------|-----------------|
| 1 | Where am I now? | Current Position |
| 2 | Where am I trying to go? | Destination |
| 3 | How far away am I? | Editorial Distance |
| 4 | What should I do next? | Next Best Action |
| 5 | Why is that the highest-value step? | Next Best Action (rationale) |
| 6 | What should I NOT change? | Protected Strengths |
| 7 | How much progress have I made? | Progress |
| 8 | What remains? | Remaining Risks + Milestones (incomplete) |

### Author experience ordering

Presentation order is constitutional for author morale and clarity:

1. **Greatest strengths** — Protected Strengths and positive progress signals
2. **Highest-value opportunities** — Improvement Opportunities ranked by impact
3. **Next step** — Next Best Action with clear rationale

Never lead with problems. Never bury strengths. The roadmap encourages; it does not discourage.

---

## 3. Contract: `storydna_editorial_roadmap@v1`

The Editorial Roadmap is a versioned, append-evolved contract persisted per manuscript edition.

| Field | Type | Notes |
|-------|------|-------|
| `contract_version` | string | Always `storydna_editorial_roadmap@v1` |
| `roadmap_id` | uuid | Stable identity |
| `manuscript_id` | uuid | Book identity |
| `manuscript_version_id` | uuid | Edition scope |
| `author_intent_id` | uuid | Source intent for Destination |
| `status` | enum | `draft`, `active`, `superseded` |
| `supersedes_roadmap_id` | uuid? | Prior roadmap linkage |
| `generated_at` | timestamp | When this version was synthesized |
| `trigger_event` | enum | What caused regeneration (see lifecycle) |
| `destination` | DestinationBlock | Where the author is going |
| `current_position` | CurrentPositionBlock | Where the manuscript stands today |
| `editorial_distance` | EditorialDistanceBlock | How far from goal |
| `protected_strengths` | ProtectedStrength[] | What must not be damaged |
| `improvement_opportunities` | ImprovementOpportunity[] | Ranked editorial opportunities |
| `recommended_editorial_team` | EditorialTeamBlock | Experts for this edition |
| `editorial_sequence` | EditorialSequenceStep[] | Ordered review plan |
| `milestones` | Milestone[] | Progress checkpoints |
| `progress` | ProgressBlock | Multi-dimensional progress scores |
| `remaining_risks` | RemainingRisk[] | Unresolved editorial risks |
| `estimated_time` | EstimateBlock | Honest time range |
| `estimated_cost` | EstimateBlock | Honest cost range |
| `confidence` | ConfidenceBlock | Roadmap synthesis confidence |
| `publication_readiness` | ReadinessBlock | Publication readiness assessment |
| `commercial_readiness` | ReadinessBlock | Commercial readiness assessment |
| `next_best_action` | NextBestActionBlock | Single highest-value step |
| `provenance` | ProvenanceBlock | Inputs used in synthesis |

---

## 4. Major Sections — Detailed Design

### 4.1 Destination

**Answers:** *Where am I trying to go?*

The Destination is derived from Author Intent (`storydna_author_intent@v1`) and, when available, conversational understanding (`storydna_editorial_understanding@v1`) and manuscript brief (`storydna_author_manuscript_brief@v1`).

| Sub-field | Source | Example |
|-----------|--------|---------|
| `intent_type` | Author Intent | `traditional_publishing` |
| `author_success_definition` | Author Intent | "Land a literary agent and submit to Big Five imprints" |
| `publication_target` | Intent + brief | Traditional publishing, query-ready |
| `timeline_preference` | Author Intent | "Ready to query within 6 months" |
| `budget_preference` | Author Intent | "Moderate — willing to invest in key experts" |
| `priority_domains` | Author Intent | `["commercial_positioning", "structure"]` |
| `custom_objective_text` | Author Intent (if custom) | Verbatim author goal |

**Rules:**
- Destination never changes silently. Intent supersession triggers roadmap regeneration.
- Destination is author-declared framing, not EIC judgment. Label: "Your goal."
- Publication state and series context constrain valid destinations (e.g., Published + Series implies continuity maintenance as implicit sub-goal).

---

### 4.2 Current Position

**Answers:** *Where am I now?*

A narrative and structured snapshot of the manuscript's editorial state at the current version.

| Sub-field | Derivation |
|-----------|------------|
| `manuscript_version_label` | Version lineage (e.g., "Version 9 — post Military Expert revision") |
| `publication_state` | Author-declared state (Draft, Revision, Submitted, Published, etc.) |
| `series_context` | Standalone, Series, Anthology, Shared Universe |
| `experts_completed` | Experts whose reviews have been adjudicated and incorporated |
| `experts_pending` | Experts in sequence not yet run |
| `revision_cycle_phase` | Pre-review, In-review, Post-review revision, Query-ready, etc. |
| `narrative_summary` | EIC-synthesized 2–4 sentence plain-English position statement |
| `key_signals` | Structured signals: structural soundness, voice maturity, market alignment, domain coverage gaps |

**Rules:**
- Current Position cites manuscript version and expert provenance.
- Position statement is EIC synthesis, not expert finding. Must not impersonate specialist judgment.
- Position updates on every roadmap regeneration trigger.

---

### 4.3 Editorial Distance

**Answers:** *How far away am I?*

See Section 6 for the full Editorial Distance model.

| Sub-field | Type |
|-----------|------|
| `distance_band` | enum: `very_close`, `close`, `moderate`, `significant`, `extensive` |
| `distance_score` | number 0–100 (100 = at destination) |
| `primary_gaps` | string[] — top 3 gaps driving distance |
| `estimation_basis` | string — honest explanation of how distance was estimated |
| `confidence` | enum: `high`, `medium`, `low` |

---

### 4.4 Protected Strengths

**Answers:** *What should I NOT change?*

Protected Strengths are the roadmap's first responsibility. Before recommending any change, StoryDNA identifies what is working and must be preserved.

| Strength category | Examples |
|-------------------|----------|
| Character voice | Distinctive POV, dialogue rhythm, internal monologue |
| Emotional climax | Key set-pieces that land; reader emotional payoff |
| Dialogue | Banter, subtext, character-specific speech patterns |
| Humor | Comic timing, wit, tonal balance |
| Theme | Thematic coherence, motif execution |
| Suspense | Pacing architecture, tension curves, reveal timing |
| Originality | Unique premise elements, fresh genre combinations |
| World-building | Setting depth, sensory immersion, cultural texture |
| Prose style | Sentence rhythm, imagery, narrative voice |

Each Protected Strength entry:

| Field | Type | Notes |
|-------|------|-------|
| `strength_id` | uuid | Stable identity across versions |
| `category` | enum | From categories above |
| `label` | string | Author-facing name ("Marcus's dry humor in Chapter 12") |
| `description` | string | Why this works; what makes it valuable |
| `evidence_locators` | Locator[] | Manuscript evidence supporting the strength |
| `supporting_experts` | string[] | Experts who affirmed this strength |
| `protection_level` | enum | `critical` (do not touch), `high` (revise with extreme care), `moderate` (preserve intent if revising nearby) |
| `author_confirmed` | boolean? | Author may affirm or dispute |

**Rules:**
- Minimum one Protected Strength required before any Improvement Opportunity is surfaced.
- Future experts receive Protected Strengths as read-only context: "Do not damage these assets."
- Protected Strengths persist across roadmap versions unless author or new expert evidence explicitly challenges them.
- EIC may add strengths from cross-expert consensus; may not invent strengths without evidence.

---

### 4.5 Improvement Opportunities

**Answers:** *What could make this manuscript stronger?* (ranked, not exhaustive)

Improvement Opportunities are editorial opportunities ranked by impact toward Destination — not a flat list of findings.

| Field | Type | Notes |
|-------|------|-------|
| `opportunity_id` | uuid | Stable identity |
| `rank` | number | 1 = highest impact toward Destination |
| `title` | string | Author-facing headline |
| `description` | string | What and why |
| `impact_toward_destination` | enum | `critical`, `high`, `moderate`, `advisory` |
| `source_findings` | uuid[] | Linked unified finding IDs |
| `source_experts` | string[] | Producing experts |
| `estimated_effort` | enum | `minor`, `moderate`, `substantial`, `major` |
| `blocks_milestone` | uuid? | Milestone this blocks if unresolved |
| `conflicts_with_strength` | uuid? | Protected Strength at risk — requires explicit author acknowledgment |
| `status` | enum | `open`, `in_progress`, `addressed`, `deferred`, `declined` |

**Rules:**
- Opportunities are deduplicated from unified findings; not 1:1 with findings.
- Ranked by Destination alignment, not by expert severity alone.
- Maximum 7 visible opportunities at once; remainder collapsed to "Additional opportunities."
- Author may defer or decline; declined opportunities remain logged but deprioritized.

---

### 4.6 Recommended Editorial Team

**Answers:** *Who should help?*

Derived from EIC editorial plan (`storydna_eic_editorial_plan@v1`) and updated as roadmap evolves.

| Sub-field | Content |
|-----------|---------|
| `required_experts` | Must-run for this intent and coverage gaps |
| `recommended_experts` | High-value additions with reasons |
| `optional_experts` | Nice-to-have coverage |
| `completed_experts` | Already run; linked to reviews |
| `declined_by_author` | Author-declined; honored |
| `unavailable_experts` | Honest "not yet built" labeling |
| `experimental_experts` | Private/experimental; labeled |

Each expert entry includes `recommendation_reason` citing intent, coverage gap, or roadmap trigger — never silent selection.

---

### 4.7 Editorial Sequence

**Answers:** *In what order should reviews happen?*

The Editorial Sequence is the roadmap's review ordering — explainable, intent-driven, and revisable.

Example sequence for traditional publishing intent:

```
1. Developmental Editor    → structure and arc foundation
2. Literary Agent            → commercial positioning on solid structure
3. Military Expert           → domain realism (if applicable)
4. Line Editor               → prose polish on revised draft
5. Literary Agent (delta)    → query readiness confirmation
```

| Field | Type | Notes |
|-------|------|-------|
| `step_order` | number | 1-based sequence position |
| `expert_key` | string | Expert identifier |
| `phase_label` | string | "Foundation", "Domain", "Polish", "Confirmation" |
| `rationale` | string | Why this expert now, not earlier or later |
| `depends_on` | uuid[]? | Prior sequence steps or milestones |
| `status` | enum | `pending`, `in_progress`, `completed`, `skipped`, `deferred` |
| `blocks_next` | boolean | Whether next step should wait for this completion |

**Sequencing rules:**

| Rule | Rationale |
|------|-----------|
| Developmental before line editing | Structure before prose |
| Domain experts after structural foundation | Avoid polishing scenes that may move |
| Literary Agent early for query intent; late for polish confirmation | Intent-driven |
| Continuity/Timeline/Archivist when series context ≠ standalone | Constitutional dual review |
| Delta reviews preferred over full re-reviews when version delta is small | §4 Version Evolution |
| Author may reorder with acknowledgment | §12 Author Rights |

Sequence must be explainable in plain English: "We recommend Developmental Editor first because your structure questions should be resolved before commercial positioning."

---

### 4.8 Milestones

See Section 7 for the full Milestone model.

---

### 4.9 Progress

See Section 5 for the full Progress model.

---

### 4.10 Remaining Risks

**Answers:** *What could still go wrong?*

| Field | Type | Notes |
|-------|------|-------|
| `risk_id` | uuid | Stable identity |
| `label` | string | Author-facing risk name |
| `description` | string | What the risk is |
| `severity` | enum | `blocking`, `significant`, `moderate`, `low` |
| `likelihood` | enum | `high`, `medium`, `low` |
| `mitigation` | string | Recommended mitigation or next step |
| `source` | string | Expert finding, EIC assessment, or author-declared concern |
| `blocks_destination` | boolean | Whether this risk blocks reaching Destination |

Remaining Risks are not a fear list. Each risk includes mitigation tied to an Improvement Opportunity or Next Best Action where possible.

---

### 4.11 Estimated Time

Honest time range for reaching Destination at current pace.

| Field | Type |
|-------|------|
| `range_label` | string (e.g., "3–6 months") |
| `range_min_weeks` | number? |
| `range_max_weeks` | number? |
| `assumptions` | string[] |
| `confidence` | enum: `high`, `medium`, `low` |

Assumptions include: author revision pace, remaining expert runs, intent type, current Editorial Distance.

---

### 4.12 Estimated Cost

Honest cost range for remaining editorial work.

| Field | Type |
|-------|------|
| `range_label` | string (e.g., "$800–$2,400") |
| `range_min_usd` | number? |
| `range_max_usd` | number? |
| `breakdown` | CostLineItem[] |
| `assumptions` | string[] |

Cost lines cite expert runs remaining in Editorial Sequence. Experimental experts labeled. No hidden costs.

---

### 4.13 Confidence

Roadmap synthesis confidence — distinct from individual expert confidence.

| Field | Type | Notes |
|-------|------|-------|
| `overall_confidence` | enum | `high`, `medium`, `low` |
| `coverage_completeness` | number 0–100 | % of intent-relevant domains reviewed |
| `expert_consensus_score` | number 0–100 | Agreement across experts on key assessments |
| `evidence_depth` | enum | `strong`, `adequate`, `thin` |
| `gaps_affecting_confidence` | string[] | What would raise confidence |

Low confidence triggers honest UI copy: "Our confidence is moderate because Military Expert has not yet reviewed the tactical scenes."

---

### 4.14 Publication Readiness

Assessment of readiness for the author's chosen publication path.

| Field | Type |
|-------|------|
| `readiness_band` | enum: `not_ready`, `early_stage`, `developing`, `approaching`, `ready`, `query_ready`, `publication_ready` |
| `readiness_score` | number 0–100 |
| `primary_blockers` | string[] |
| `ready_elements` | string[] |
| `path_specific_notes` | string |

Path-specific bands: query-ready (traditional), production-ready (self-pub), submission-ready (screenplay), etc.

---

### 4.15 Commercial Readiness

Assessment of market and commercial positioning readiness — primarily Literary Agent domain.

| Field | Type |
|-------|------|
| `readiness_band` | enum: `not_assessed`, `early_stage`, `developing`, `competitive`, `strong`, `submission_ready` |
| `readiness_score` | number 0–100 |
| `comp_title_alignment` | string? |
| `hook_strength` | enum? |
| `market_gap_notes` | string? |
| `primary_blockers` | string[] |

Commercial readiness is N/A or "not yet assessed" when Literary Agent has not run and intent does not require commercial review.

---

### 4.16 Next Best Action

**Answers:** *If you only did one thing next, what should it be — and why?*

The single highest-value editorial step at this moment.

| Field | Type | Notes |
|-------|------|-------|
| `action_type` | enum | See action types below |
| `title` | string | Author-facing headline |
| `description` | string | What to do |
| `rationale` | string | Why this is highest-value now |
| `expected_impact` | string | What improves if author completes this |
| `estimated_effort` | enum | `minutes`, `hours`, `days`, `weeks` |
| `linked_opportunity` | uuid? | Improvement Opportunity this addresses |
| `linked_expert` | string? | Expert to run or consult |
| `linked_milestone` | uuid? | Milestone this advances |
| `alternative_if_declined` | string? | Second-best action if author declines |

**Action types:**

| Type | Example |
|------|---------|
| `run_expert` | "Run Developmental Editor on Version 9" |
| `author_revision` | "Revise Chapter 12 opening hook per Literary Agent finding" |
| `confirm_strength` | "Review and confirm Protected Strength: Marcus's voice in Ch. 3–7" |
| `resolve_risk` | "Address timeline inconsistency flagged by Continuity Expert" |
| `author_decision` | "Decide: query now or run one more structural pass" |
| `approve_team` | "Approve recommended editorial team to begin reviews" |
| `update_intent` | "Update Author Intent — your goal has shifted since last activation" |

**Rules:**
- Exactly one Next Best Action per active roadmap. No ambiguity.
- Rationale must cite Destination alignment, not generic urgency.
- If no expert has run yet, Next Best Action is typically `approve_team` or `run_expert` (first in sequence).
- Author may decline; roadmap regenerates with `alternative_if_declined` promoted.

---

## 5. Progress Model

Progress is **not** issues closed. Progress measures editorial advancement toward Destination across seven dimensions.

### Progress dimensions

| Dimension | What it measures | Primary inputs |
|-----------|------------------|----------------|
| **Story Strength** | Craft quality: structure, voice, character, pacing, theme | Developmental Editor, Literary Agent, cross-expert strength signals |
| **Publication Readiness** | Readiness for author's publication path | Intent type, publication state, structural + polish completeness |
| **Commercial Readiness** | Market positioning, hook, comp alignment | Literary Agent, intent type |
| **Editorial Confidence** | How well StoryDNA understands this manuscript | Expert coverage, evidence depth, consensus |
| **Continuity** | Internal and series consistency | Continuity Expert, Timeline Expert, Archivist |
| **Expert Consensus** | Agreement across experts on key assessments | Cross-expert adjudication, contradiction resolution |
| **Author Goal Alignment** | Manuscript trajectory vs declared Destination | Intent comparison, vision alignment assessment |

### Scoring

Each dimension scores 0–100. Score derivation is deterministic given inputs:

| Score range | Label | Meaning |
|-------------|-------|---------|
| 0–20 | Early | Significant work remains |
| 21–40 | Developing | Foundation forming |
| 41–60 | Moderate | Substantial progress; clear gaps remain |
| 61–80 | Strong | Approaching destination |
| 81–100 | Excellent / Ready | At or near destination for this dimension |

### ProgressBlock structure

```typescript
type ProgressBlock = {
  dimensions: {
    story_strength: ProgressDimension;
    publication_readiness: ProgressDimension;
    commercial_readiness: ProgressDimension;
    editorial_confidence: ProgressDimension;
    continuity: ProgressDimension;
    expert_consensus: ProgressDimension;
    author_goal_alignment: ProgressDimension;
  };
  overall_progress_score: number; // weighted by intent type
  progress_since_last_version: ProgressDelta;
  progress_narrative: string; // 1-2 encouraging sentences
};
```

### Weighting by intent

Intent type determines dimension weights for `overall_progress_score`:

| Intent | Top-weighted dimensions |
|--------|------------------------|
| Traditional publishing | Commercial Readiness, Publication Readiness, Story Strength |
| Military realism | Story Strength, Editorial Confidence, Continuity |
| Developmental editing | Story Strength, Author Goal Alignment |
| Series consistency | Continuity, Expert Consensus, Story Strength |
| Query preparation | Commercial Readiness, Publication Readiness |

### Progress delta

`progress_since_last_version` compares current scores to prior roadmap version:

| Field | Type |
|-------|------|
| `prior_roadmap_id` | uuid |
| `dimension_deltas` | Record<string, number> |
| `milestones_completed_since` | uuid[] |
| `narrative` | string — "Story Strength improved 12 points after your Chapter 12 revision." |

**Anti-pattern:** Never equate progress with "findings closed" or "revision board items completed." A author who rejects 10 findings and improves one structural issue has made progress.

---

## 6. Editorial Distance Model

Editorial Distance measures how far the current manuscript is from the author's declared Destination.

### Distance bands

| Band | Score range | Meaning | Typical author copy |
|------|-------------|---------|---------------------|
| **Very Close** | 81–100 | Query-ready or publication-ready for stated goal | "You're very close to your goal." |
| **Close** | 61–80 | Minor targeted work remains | "You're close — a focused pass should get you there." |
| **Moderate** | 41–60 | Significant but achievable work remains | "Solid progress — several editorial passes ahead." |
| **Significant** | 21–40 | Major editorial work required | "There's meaningful work ahead, and we have a clear plan." |
| **Extensive** | 0–20 | Early stage or major structural gap | "You're building the foundation — here's where to start." |

### Estimation inputs

StoryDNA estimates Editorial Distance from:

| Input | Weight | Notes |
|-------|--------|-------|
| Progress dimension scores | High | Weighted by intent |
| Unresolved blocking risks | High | Blocking risks cap distance score |
| Expert coverage completeness | Medium | Uncovered domains increase distance |
| Publication Readiness band | Medium | Direct path indicator |
| Milestone completion ratio | Medium | Completed milestones reduce distance |
| Author Goal Alignment score | Medium | Vision-execution gap |
| Editorial Sequence completion | Low | Steps remaining in sequence |

### Estimation formula (design)

```
distance_score = weighted_mean(progress_dimensions)
               - blocking_risk_penalty
               - coverage_gap_penalty
               + milestone_completion_bonus

distance_band = band_lookup(distance_score)
```

Penalties and bonuses are deterministic, documented, and auditable. No ML inference in Phase 1.

### Honest estimation

| Rule | Requirement |
|------|-------------|
| Thin evidence | Distance confidence = low; UI says "Preliminary estimate" |
| No experts run | Distance based on intent + brief + EIC independent read only |
| Single expert | Distance labeled "Partial — one expert perspective" |
| Conflicting experts | Distance confidence reduced; consensus gap noted |

---

## 7. Milestone Model

Milestones are editorial checkpoints — not tasks — marking meaningful progress toward Destination.

### Milestone types

| Type | Example |
|------|---------|
| `intent_captured` | Author Intent activated |
| `team_approved` | Editorial team approved by author |
| `expert_review_complete` | Named expert review adjudicated |
| `structural_soundness` | Developmental Editor confirms structure is sound |
| `domain_clearance` | Domain expert (Military, Medical, etc.) clearance |
| `commercial_assessment` | Literary Agent commercial review complete |
| `revision_cycle_complete` | Author revision cycle after expert pass |
| `protected_strengths_confirmed` | Author confirmed Protected Strengths |
| `query_ready` | Manuscript meets query-ready criteria for intent |
| `publication_ready` | Manuscript meets publication-ready criteria |
| `custom` | Author or EIC-defined checkpoint |

### Milestone structure

| Field | Type | Notes |
|-------|------|-------|
| `milestone_id` | uuid | Stable identity |
| `type` | enum | From types above |
| `label` | string | Author-facing name |
| `description` | string | What this milestone means |
| `status` | enum | `upcoming`, `in_progress`, `achieved`, `skipped`, `blocked` |
| `order` | number | Display order on roadmap |
| `depends_on` | uuid[]? | Prior milestones |
| `blocked_by` | uuid[]? | Risks or opportunities blocking achievement |
| `achieved_at` | timestamp? | When achieved |
| `achieved_on_version` | uuid? | Manuscript version at achievement |
| `evidence` | string? | What confirmed achievement |

### Milestone sequencing

Default milestone chain for traditional publishing:

```
intent_captured → team_approved → expert_review_complete (DE)
→ structural_soundness → expert_review_complete (LA)
→ commercial_assessment → revision_cycle_complete
→ query_ready
```

Milestones adapt to intent type. Military realism intent inserts `domain_clearance` before commercial milestones.

### Milestone vs. task

| Milestone | Task |
|-----------|------|
| "Structure is sound" | "Fix pacing in Chapter 7" |
| Editorial checkpoint | Implementation detail |
| Achieved by evidence | Achieved by author action |
| Shown on roadmap | Shown on revision board or in opportunity detail |

---

## 8. Roadmap Lifecycle

The Editorial Roadmap is a **living document**. It regenerates after every meaningful editorial event.

### Regeneration triggers

| Trigger | Regeneration scope |
|---------|-------------------|
| Author Intent activated or superseded | Full — Destination changes |
| Manuscript version created | Full — Current Position changes |
| Expert review adjudicated | Partial — incorporate findings, update progress, sequence, opportunities |
| Author revision accepted/rejected on revision board | Partial — update opportunities, progress, next action |
| Protected Strength confirmed or disputed by author | Partial — update strengths, check conflicts |
| Editorial team approved or modified | Partial — update sequence, team, next action |
| Milestone achieved | Partial — update progress, distance, next action |
| Publication state changed | Full — constraints change |
| Conversational understanding confirmed | Partial — may update Destination derivation |
| Author declines Next Best Action | Partial — promote alternative |

### Version evolution

```
Roadmap v1 (intent captured)
    → Expert A review → Roadmap v2
    → Author revision → Roadmap v3
    → Expert B review → Roadmap v4
    → Milestone achieved → Roadmap v5
    → ...
```

Each version:
- Supersedes prior (`supersedes_roadmap_id`)
- Preserves history (append-only)
- Records `trigger_event` and `provenance`

### Status lifecycle

| Status | Meaning |
|--------|---------|
| `draft` | Synthesized but not yet author-visible (e.g., mid-adjudication) |
| `active` | Current author-facing roadmap |
| `superseded` | Replaced by newer version; preserved for history |

One active roadmap per `(manuscript_id, manuscript_version_id, author_intent_id)`.

---

## 9. Future Integrations

The Editorial Roadmap aggregates inputs from across the StoryDNA platform.

### Integration map

| System | Integration role |
|--------|-----------------|
| **Author Intent** (`storydna_author_intent@v1`) | Defines Destination |
| **EIC Editorial Plan** (`storydna_eic_editorial_plan@v1`) | Seeds Recommended Editorial Team and initial Sequence |
| **Conversational Intelligence** | Enriches Destination from editorial understanding |
| **Manuscript Brief** (`storydna_author_manuscript_brief@v1`) | Seeds Current Position and Author Goal Alignment |
| **Literary Agent** | Commercial Readiness, Protected Strengths (voice, hook), Improvement Opportunities |
| **Military Expert** | Domain clearance milestone, Protected Strengths (tactical authenticity), Improvement Opportunities |
| **Developmental Editor** | Story Strength, structural milestones, sequencing priority |
| **Line Editor** (future) | Story Strength (prose), late-sequence placement |
| **Continuity Expert / Timeline Expert / Archivist** | Continuity dimension, series milestones |
| **Cross-expert Adjudication** | Expert Consensus dimension, deduplicated opportunities |
| **Unified Findings** | Improvement Opportunities source |
| **Revision Board** | Opportunity status updates, progress delta (not primary progress metric) |
| **Publication State** | Readiness constraints, milestone definitions |
| **Series Context** | Continuity dimension weighting, mandatory experts |
| **Version Evolution** | Current Position, delta review triggers, progress delta |
| **Cost Accounting** | Estimated Cost breakdown |

### Studio UX placement

```
/studio/books/[bookId]/roadmap     ← primary author home (future)
/studio/books/[bookId]/intent      ← Destination source
/studio/books/[bookId]/experts     ← team and sequence detail
/studio/books/[bookId]/reports     ← expert inputs (secondary navigation)
```

When roadmap is enabled, the book workspace opens to the Editorial Roadmap — not the report list.

### Expert context injection

When an expert runs, the workflow receives read-only roadmap context:

| Injected field | Purpose |
|----------------|---------|
| Destination | Intent alignment |
| Protected Strengths | Do-not-damage list |
| Current Position | What has already been assessed |
| Prior expert summaries | Avoid re-discovery |
| Editorial Sequence position | Why this expert runs now |

Experts do not write to the roadmap directly. Expert outputs flow through adjudication into roadmap regeneration.

---

## 10. Author Experience Principles

| Principle | Implementation |
|-----------|----------------|
| Never wonder what's next | Next Best Action always visible above fold |
| Encourage first | Protected Strengths and progress narrative before opportunities |
| One organization | Roadmap voice is EIC editorial strategy, not a stack of tools |
| Honest availability | Unavailable and experimental experts labeled on team section |
| Author control | Decline, defer, reorder — roadmap adapts |
| Evidence grounding | Every claim links to evidence, expert, or intent |
| Living document | "Updated after Military Expert review — Version 9" timestamp |
| No fear lists | Remaining Risks paired with mitigations |

### Copy standards

| Context | Tone |
|---------|------|
| Protected Strengths | Celebratory, specific, evidence-cited |
| Improvement Opportunities | Constructive, ranked, actionable |
| Next Best Action | Clear, confident, rationale included |
| Editorial Distance | Honest but encouraging |
| Low confidence | Transparent about what's missing |

---

## 11. Implementation Phases

**Design phase only.** No runtime code, migrations, or providers in ER-0.

| Phase | Scope | Depends on |
|-------|-------|------------|
| **ER-0** | Framework design + governance (this document) | Amendment 001 |
| **ER-1** | Contract types, validation, distance/progress formulas (`lib/editorial-roadmap/`) | ER-0, Phase 1A intent |
| **ER-2** | Roadmap synthesis service (deterministic, no providers) | ER-1, EIC adjudication |
| **ER-3** | Persistence + migration | ER-2 |
| **ER-4** | Regeneration triggers wired to adjudication + version events | ER-3 |
| **ER-5** | Studio roadmap UI (author home) | ER-4 |
| **ER-6** | Expert context injection from roadmap | ER-4 + per-expert review |
| **ER-7** | Milestone automation + author confirmation flows | ER-5 |
| **ER-8** | Cost/time estimation integration | ER-2 + cost accounting |

### Explicitly out of scope for ER-0 through ER-2

- Provider calls for roadmap narrative generation (deterministic templates first)
- ML-based distance estimation
- Replacing revision board or unified findings
- Auto-launching experts from Next Best Action (author confirmation required)

---

## 12. Risks

| Risk | Mitigation |
|------|------------|
| Roadmap feels like another report to read | Roadmap-first UX; strengths → opportunities → one next step; not finding dumps |
| Progress gamed by closing revision board items | Progress model explicitly excludes issue-closure metrics |
| Protected Strengths invented without evidence | Minimum evidence locator required; expert attribution |
| Editorial Distance feels arbitrary | Deterministic formula, auditable inputs, confidence labeling |
| Next Best Action conflicts with author preference | Author decline promotes alternative; never forced |
| Roadmap stale after author revision | Version-change trigger mandatory |
| Experts ignore Protected Strengths | Injected as read-only workflow context; EIC flags violations in regeneration |
| Roadmap duplicates unified findings | Opportunities are deduplicated, ranked synthesis — not 1:1 finding list |
| Low expert coverage produces overconfident distance | Thin-evidence rules cap confidence and distance score |
| Roadmap replaces author creative control | §12 rights explicit; roadmap recommends only |
| Scope creep into expert judgment | Hard boundary: EIC synthesis, not specialist findings |

---

## 13. Acceptance Criteria

1. Framework document defines all 16 major roadmap sections with field-level design.
2. The eight mandatory author questions map to explicit roadmap sections.
3. Progress model uses seven dimensions; explicitly excludes issue-closure counting.
4. Editorial Distance model defines five bands with deterministic estimation inputs.
5. Protected Strengths are the first responsibility; minimum one required before opportunities.
6. Next Best Action is singular with typed action categories and rationale requirement.
7. Editorial Sequence is explainable, intent-driven, and author-reorderable.
8. Milestone model distinguishes checkpoints from tasks.
9. Roadmap lifecycle defines regeneration triggers and version evolution.
10. Future integrations map all current and planned platform systems.
11. Author experience ordering is strengths → opportunities → next step.
12. `storydna_editorial_roadmap@v1` contract sketched with required fields.
13. `cap.editorial_roadmap` registered in CAPABILITY_REGISTRY.json.
14. `npm run governance:capability-check` passes on this document.
15. No runtime code, migrations, or providers in this design task.

---

## 14. Governance

- **Registry:** `cap.editorial_roadmap` in [CAPABILITY_REGISTRY.json](../capabilities/CAPABILITY_REGISTRY.json)
- **Conformance:** `npm run governance:capability-check -- docs/governance/implementation/STORYDNA_EDITORIAL_ROADMAP_FRAMEWORK.md`
- **Constitution:** Complies with §0, §1, §6, §8, §10, §12, §13, §14 and Amendment 001

---

## Appendix A — Roadmap Section → Author Question Map

| Author question | Primary section(s) |
|-----------------|-------------------|
| Where am I now? | Current Position, Progress |
| Where am I trying to go? | Destination |
| How far away am I? | Editorial Distance |
| What should I do next? | Next Best Action |
| Why is that the highest-value step? | Next Best Action (rationale) |
| What should I NOT change? | Protected Strengths |
| How much progress have I made? | Progress, Milestones (achieved) |
| What remains? | Remaining Risks, Milestones (upcoming), Improvement Opportunities |

---

## Appendix B — Intent → Default Milestone Chain

| Intent type | Default milestones |
|-------------|-------------------|
| `traditional_publishing` | intent → team → DE → structure → LA → commercial → revision → query_ready |
| `self_publishing` | intent → team → DE → structure → LA → line edit → publication_ready |
| `military_realism` | intent → team → DE → structure → ME → domain_clearance → revision |
| `developmental_editing` | intent → team → DE → structure → revision → author_decision |
| `query_preparation` | intent → team → LA → commercial → revision → query_ready |
| `series_consistency` | intent → team → continuity → timeline → structure → revision |
| `continuity_review` | intent → team → continuity → timeline → archivist → revision |
