# EIC Initial Editorial Roadmap Creation Framework

**Document type:** Platform architecture design (no runtime implementation)  
**Owner:** Kevin Track / StoryDNA Editorial Organization  
**Branch baseline:** `feature/eic-phase-1a-author-intent`  
**Constitution baseline:** v1.0 + Amendment 001 (RATIFIED)  
**Related artifacts:** [STORYDNA_EDITORIAL_ROADMAP_FRAMEWORK.md](./STORYDNA_EDITORIAL_ROADMAP_FRAMEWORK.md), [STORYDNA_CONVERSATIONAL_INTELLIGENCE_FRAMEWORK.md](./STORYDNA_CONVERSATIONAL_INTELLIGENCE_FRAMEWORK.md), [EIC_CONVERSATIONAL_INTAKE_AND_TEAM_APPROVAL_UX_BLUEPRINT.md](./EIC_CONVERSATIONAL_INTAKE_AND_TEAM_APPROVAL_UX_BLUEPRINT.md)

**Scope:** This framework defines exactly how the Editor-in-Chief creates the author's **first** Editorial Roadmap — after manuscript brief, confirmed understanding, independent read, and strengths/risks identification — **before any specialist has received the manuscript**.

**Note on source documents:** `EIC_INDEPENDENT_READ_FRAMEWORK.md` does not yet exist as a standalone artifact. Independent-read boundaries and contracts are incorporated here from [EIC_CONVERSATIONAL_INTAKE_AND_TEAM_APPROVAL_UX_BLUEPRINT.md](./EIC_CONVERSATIONAL_INTAKE_AND_TEAM_APPROVAL_UX_BLUEPRINT.md) §9–§10 and [STORYDNA_CONVERSATIONAL_INTELLIGENCE_FRAMEWORK.md](./STORYDNA_CONVERSATIONAL_INTELLIGENCE_FRAMEWORK.md) §9.

---

## 1. Plain-English Vision

The first Editorial Roadmap is the moment StoryDNA stops being a collection of tools and becomes **one editorial organization with a plan**.

After the author shares their goals and the EIC reads the manuscript independently — with no specialist involved yet — the EIC presents a single, encouraging, honest strategy document that answers:

- Where is my manuscript now?
- Where am I trying to take it?
- What is already working and must be protected?
- What has the highest improvement potential?
- Which experts should help, in what order, at what cost, and why?
- What is the one best thing to do next?

The first roadmap is **not** a report, not a finding list, and not a grade in isolation. It is EIC-owned editorial strategy synthesized from author-declared goals and manuscript evidence from the independent read. Every claim carries burden of proof (§13). The author approves the roadmap before any expert receives manuscript access.

The roadmap must begin positively — strengths and protected assets first — without flattery, without hiding material gaps, and without fake precision on cost, time, or grade movement.

---

## 2. Constitution Compliance

```json
{
  "applicable_sections": ["§0", "§1", "§6", "§8", "§10", "§12", "§13", "§14"],
  "compliance_explanation": "Initial roadmap creation implements §0 Editorial Mission by producing one coherent editorial experience before expert recruitment. §1 Author Intent and confirmed Editorial Understanding define Destination; the EIC measures distance from author-declared goals, not expert preference. §6 Expert Governance is preserved: no specialist has the manuscript; the EIC does not produce retained expert findings or impersonate specialists. §8 Report Governance: the roadmap is the primary author-facing deliverable; disconnected expert reports do not exist at this stage. §10 EIC Governance: the EIC owns synthesis, sequencing, ROI estimation, and next-action selection without generating specialist judgments. §12 Author Rights: authors approve, modify, defer, or decline the roadmap and expert team; no expert receives manuscript access without author permission. §13 Burden of Proof: every strength, risk, grade, and recommendation cites manuscript locators or author-declared intent; structural inference alone is insufficient. §14 conformance tests are defined in Section 21. Amendment 001 capability reviews completed in Section 3.",
  "amendment_required": "No",
  "backward_compatibility_impact": "Additive design layer. Extends storydna_editorial_roadmap@v1 with initial-creation lifecycle and pre-expert input rules. Existing Phase 1A intent, Phase 1B brief, and conversational intelligence artifacts remain unchanged when roadmap flags are off.",
  "certification_impact": "No expert commercially enabled. Initial roadmap synthesis is EIC orchestration only. Expert recommendations honor existing certification tiers with honest unavailable/experimental labeling."
}
```

---

## 3. Capability Propagation Review

### Primary capability

```json
{
  "new_capability_introduced": "EIC Initial Editorial Roadmap Creation (cap.eic_initial_roadmap_creation)",
  "existing_capability_modified": "cap.editorial_roadmap — initial-creation subprocess, pre-expert input gate, author approval lifecycle",
  "classification": "editor_in_chief_owned",
  "existing_experts_evaluated": ["literary_agent", "military_expert", "developmental_editor", "editor_in_chief"],
  "future_experts_affected": ["line_editor", "character_expert", "continuity_expert", "timeline_expert", "archivist", "combat_medicine_expert", "financial_crimes_expert", "producer", "screenplay_editor"],
  "editor_in_chief_impact": "Primary owner. The EIC executes the 11-stage initial roadmap creation pipeline after independent read, before any specialist manuscript access.",
  "platform_impact": "New pre-expert gate, contract fields, author-facing 12-section screen, and approval workflow. Feeds cap.editorial_roadmap lifecycle.",
  "certification_impact": "No commercial enablement. Expert recommendations are honest about certification and availability.",
  "propagation_decision": "move_to_editor_in_chief",
  "review_artifact_path": "docs/governance/implementation/EIC_INITIAL_EDITORIAL_ROADMAP_CREATION_FRAMEWORK.md"
}
```

### Sub-capability classifications (evaluated — not auto-approved)

| # | Sub-capability | Proposed classification | Final classification | Propagation decision | Evaluation rationale |
|---|----------------|------------------------|---------------------|---------------------|----------------------|
| 1 | Initial roadmap creation | editor_in_chief_owned | **editor_in_chief_owned** | move_to_editor_in_chief | Pre-expert synthesis is pure EIC orchestration. No expert produces findings at this stage. Confirmed. |
| 2 | Protected-strength identification | editorial_board_shared | **editor_in_chief_owned** (initial); **editorial_board_shared** (post-expert affirmation) | split: move_to_editor_in_chief for initial; defer expert affirmation to editorial_board_shared at ER-6 | At first roadmap, only the EIC independent read identifies strengths — no experts exist yet. The *vocabulary* (Protect/Strengthen/Improve/Reconsider) is platform-wide, but *identification* at initial creation is EIC-owned. When experts later run, they may affirm, challenge, or add strengths — that contribution is editorial_board_shared and requires a separate propagation task at expert-context injection (ER-6). Initial classification editorial_board_shared is **rejected** for pre-expert creation. |
| 3 | Editorial-distance estimation | editor_in_chief_owned | **editor_in_chief_owned** | move_to_editor_in_chief | Distance is EIC synthesis from intent + independent read + grade/readiness. Experts inform later regenerations but do not own distance estimation. Confirmed. |
| 4 | Grade and readiness estimation | editorial_board_shared | **editor_in_chief_owned** (initial); **editorial_board_shared** (grade vocabulary + post-expert refinement) | split: move_to_editor_in_chief for initial grade assignment; grade standard vocabulary is platform-wide | First grade comes solely from EIC independent read — no Literary Agent or DE has run. Assigning editorial_board_shared would incorrectly imply expert co-ownership before experts exist. The grading *standard* (A+ through F definitions) is a shared platform vocabulary; initial *estimation* is EIC-owned. Post-expert, experts supply domain readiness signals that refine grade blocks — that refinement is editorial_board_shared. |
| 5 | Expert sequencing | editor_in_chief_owned | **editor_in_chief_owned** | move_to_editor_in_chief | Sequencing is constitutional EIC recruitment responsibility (§10). Confirmed. |
| 6 | Editorial ROI estimation | editor_in_chief_owned | **editor_in_chief_owned** | move_to_editor_in_chief | ROI classification is EIC prioritization logic, not expert judgment. Confirmed. |
| 7 | Next-best-action selection | editor_in_chief_owned | **editor_in_chief_owned** | move_to_editor_in_chief | Single next action is EIC prioritization per §10. Confirmed. |
| 8 | Roadmap confidence | *(unevaluated in prompt)* | **editor_in_chief_owned** | move_to_editor_in_chief | Roadmap confidence aggregates input completeness (understanding confidence, independent-read coverage, evidence depth). It is EIC synthesis metadata, not an expert finding. Experts do not produce roadmap_confidence scores. |
| 9 | Author roadmap approval | platform_wide | **platform_wide** | move_to_platform | Author approval gate is a cross-cutting author-rights workflow (§12). Applies to roadmap, team permission, and expert desk. Confirmed. |

### Propagation summary

- **Confirmed as proposed:** initial roadmap creation, editorial distance, expert sequencing, ROI estimation, next-best action, author roadmap approval.
- **Modified from proposed:** protected-strength identification (EIC-owned at initial creation; expert affirmation deferred), grade/readiness estimation (EIC-owned at initial creation; shared vocabulary only).
- **Newly evaluated:** roadmap confidence → editor_in_chief_owned.

---

## 4. Inputs and Exclusions

### Precondition gate

Initial roadmap creation may begin **only when all** are true:

| Gate | Artifact / state |
|------|------------------|
| Manuscript brief submitted | `storydna_author_manuscript_brief@v1` status = `submitted` |
| Understanding confirmed | `storydna_editorial_understanding@v1` status = `confirmed` |
| Independent read complete | `storydna_eic_independent_read@v1` status = `complete` |
| No specialist access | Zero expert workflows have received manuscript bytes for this version |
| Manuscript version authoritative | Current `manuscript_version_id` matches brief and understanding scope |

### Allowed inputs (Stage 1)

| Input | Contract / source | Use in synthesis |
|-------|-------------------|------------------|
| Author manuscript brief | `storydna_author_manuscript_brief@v1` | Destination derivation, genre/market framing, author concerns |
| Confirmed Editorial Understanding | `storydna_editorial_understanding@v1` | Destination success criteria, alignment baseline |
| Authoritative manuscript text | Manuscript version store | Evidence locators, strength/risk identification |
| Publication state | Edition metadata (§2) | Readiness constraints, milestone definitions |
| Series context | Edition metadata (§3) | Mandatory continuity experts, dual-review flags |
| Manuscript version | Version lineage | Scope, label, provenance |
| EIC independent-read output | `storydna_eic_independent_read@v1` | Strengths, risks, alignment, coverage signals |
| Vision alignment (if produced) | `storydna_eic_vision_alignment@v1` | Author-goal alignment, unresolved questions |

### Prohibited inputs

| Prohibited input | Reason |
|------------------|--------|
| Specialist reports (any expert) | Violates pre-expert boundary; would mix expert findings with EIC synthesis |
| Prior specialist judgments for current version | Same — no expert has run on this version |
| Unsupported market claims | §13 — no evidence, no claim |
| Inferred canon presented as confirmed | §7 — only author declarations establish canon |
| Provider summaries not tied to manuscript evidence | §13 — burden of proof unmet |
| Revision board items | No findings exist yet |
| Unified findings | Post-expert artifact only |
| Author pitch / understanding as manuscript evidence | Framing only; labeled "What you told me" |

### Input validation rule

If any prohibited input is detected at synthesis time, creation aborts to `draft` with error `PROHIBITED_INPUT_DETECTED`. The EIC must not silently incorporate expert artifacts from prior versions unless explicitly scoped as historical context with `is_current_version_evidence: false`.

---

## 5. Roadmap Creation Lifecycle (11 Stages)

```
[Gate] brief submitted + understanding confirmed + independent read complete + no specialist access
    │
    ▼
Stage 1  Gather inputs (allowed/prohibited enforcement)
    ▼
Stage 2  Identify protected strengths (Protect / Strengthen / Improve / Reconsider)
    ▼
Stage 3  Define destination (measurable from author goal)
    ▼
Stage 4  Establish current position (understanding → strengths → protected → opportunities → grade → roadmap)
    ▼
Stage 5  Assign grade and readiness (StoryDNA Editorial Grading Standard)
    ▼
Stage 6  Estimate editorial distance
    ▼
Stage 7  Recommend experts (+ identify unnecessary experts)
    ▼
Stage 8  Build editorial sequence (dependency-aware ordering)
    ▼
Stage 9  Estimate editorial ROI (per phase)
    ▼
Stage 10 Select next best action (exactly one)
    ▼
Stage 11 Present for author approval
    │
    ├─ approved → status: approved; team permission gate may proceed
    ├─ revised → partial regeneration from affected stage
    └─ declined → status: cancelled; return to goals conversation
```

### Stage 1 — Gather inputs

**Purpose:** Assemble and validate all allowed inputs; reject prohibited inputs.

**Actions:**
1. Load brief, understanding, independent read, version metadata, publication state, series context.
2. Verify pre-expert gate (no specialist manuscript access).
3. Build provenance block listing every input artifact ID and timestamp.
4. Compute input completeness score for roadmap confidence.

**Output:** Validated input bundle → internal `InitialRoadmapInputBundle`.

**Failure:** Missing required artifact → abort; do not synthesize partial roadmap.

---

### Stage 2 — Identify protected strengths

**Purpose:** Begin positively. Identify what works, what to protect, and what future experts must not damage.

**Mandatory order within stage:**
1. Strongest manuscript assets (from independent read)
2. Author achievements (execution vs stated vision)
3. Elements to protect during revision
4. Evidence locators for every claim

**Disposition categories:**

| Category | Meaning | Default protection level |
|----------|---------|-------------------------|
| **Protect** | Working well; do not revise except minimally | `critical` |
| **Strengthen** | Strong foundation; refinement could elevate | `high` |
| **Improve** | Promising but needs development; not a liability | `moderate` |
| **Reconsider** | May conflict with destination; author should weigh tradeoff | `moderate` (flagged) |

**Rules:**
- Minimum **two** entries before Stage 3 proceeds (at least one `Protect` or `Strengthen`).
- Every entry requires ≥1 manuscript evidence locator.
- No flattery adjectives without evidence ("brilliant" forbidden unless tied to specific craft evidence).
- `Reconsider` entries are not failures — they are honest tradeoffs.

---

### Stage 3 — Define destination

**Purpose:** Translate author goal into measurable destination block.

**Source hierarchy:**
1. `success_definition` from confirmed understanding (primary)
2. Manuscript brief goals
3. Derived intent type (author confirms at approval — not auto-set silently)

**Destination must include measurable success criteria:**

| Intent pattern | Example measurable criteria |
|----------------|----------------------------|
| Traditional publishing / query | Query letter ready; opening 5 pages agent-competitive; comp-title alignment assessed |
| Self-publishing | Production-ready interior/exterior standards met; market positioning confirmed |
| Series continuity | No unresolved canon conflicts; timeline consistent with prior published editions |
| Screen adaptation | Visual set-pieces identified; act structure assessable |
| Military authenticity | Tactical/medical scene inventory cleared by domain expert (future milestone) |
| Word-count reduction | Target count achieved without damaging protected strengths |

**Rules:**
- Destination labeled **"Your goal"** — author-declared framing.
- Publication state and series context may add implicit sub-criteria (e.g., Published → no silent canon retcons).
- Destination never inferred from market metadata alone.

---

### Stage 4 — Establish current position

**Purpose:** Structured snapshot of where the manuscript stands today.

**Constitutional synthesis order (mandatory — grade NEVER first):**

| Order | Component | Source |
|-------|-----------|--------|
| 1 | Understanding recap | Confirmed understanding summary (labeled author-provided) |
| 2 | Major strengths | Stage 2 output (Protect + Strengthen) |
| 3 | Protected assets | Stage 2 Protect entries |
| 4 | Improvement opportunities | Independent read risks → ranked opportunities (max 7 visible) |
| 5 | Grade and readiness | Stage 5 output (invoked here in presentation; computed in Stage 5) |
| 6 | Roadmap summary | Stages 6–10 condensed narrative |

**Current position fields:**

| Field | Description |
|-------|-------------|
| `current_manuscript_stage` | e.g., `first_draft`, `revision_draft`, `post_beta`, `pre_query`, `published_revision` |
| `narrative_summary` | 2–4 sentence EIC plain-English position statement |
| `major_strengths` | Top 3 strength headlines |
| `material_risks` | Top 3 risks with mitigation hints |
| `author_goal_alignment` | From vision alignment: strongly / substantially / partially / materially misaligned |
| `publication_readiness` | Band (Stage 5) |
| `commercial_readiness` | Band or `not_yet_assessable` (no LA yet) |
| `key_signals` | Structured: structural soundness, voice maturity, market alignment, domain coverage gaps |

**Hard rule:** UI and narrative must not open with a letter grade. Grade appears only after strengths and protected assets (Section 18).

---

### Stage 5 — Define grading standard

**Purpose:** Assign current grade and readiness using the StoryDNA Editorial Grading Standard.

See Section 9 for full grade definitions and threshold evaluation.

**Each grade assignment includes:**
- `definition` — what this grade means for this manuscript
- `rationale` — why this grade, citing evidence
- `confidence` — `high` | `medium` | `low`
- `evidence` — locator array
- `improvement_path` — realistic path to next grade band
- `potential_grade_ceiling` — best achievable grade for this manuscript architecture (honest)

**Readiness bands (parallel to grade):**
- Publication readiness: `not_ready` | `early_stage` | `developing` | `approaching` | `ready` | `query_ready` | `publication_ready`
- Commercial readiness: `not_assessable` (pre-LA) | `early_stage` | `developing` | `competitive` | `strong` | `submission_ready`

**Pre-expert constraint:** Commercial readiness defaults to `not_assessable` unless independent read surfaces strong commercial signals — in which case label `preliminary` with low confidence.

---

### Stage 6 — Estimate editorial distance

**Purpose:** Quantify gap between current position and destination.

See Section 10 for band definitions.

**Output fields:**
- `distance_band` — Very Close | Close | Moderate | Significant | Extensive
- `distance_score` — 0–100 (100 = at destination)
- `revision_magnitude` — approximate scope (see Section 10)
- `likely_phases` — count range
- `likely_expert_involvement` — expert count range
- `regression_risk` — `low` | `medium` | `high`
- `re_review_required` — boolean + explanation
- `estimation_basis` — honest explanation
- `confidence` — `high` | `medium` | `low`

**Pre-expert rule:** Distance confidence cannot exceed `medium` without at least one domain expert plan on the sequence.

---

### Stage 7 — Recommend experts

**Purpose:** Propose editorial team with full transparency.

See Section 11 for expert entry schema.

**Also required:** `excluded_experts[]` — experts **not** recommended with explicit reasons (e.g., "Line Editor deferred until structural pass complete", "Financial Crimes Expert not indicated — no finance plot signals in independent read").

**Rules:**
- Honor author `declined_experts` from intent/brief.
- Unavailable experts shown with honest labeling — never as ready.
- Experimental experts labeled `experimental` — advisory only for Published state (§2).

---

### Stage 8 — Build editorial sequence

**Purpose:** Order expert runs to prevent wasteful review.

See Section 12 for ordering logic.

**Output:** `roadmap_phases[]` with dependencies, `editorial_sequence[]` with step order, `depends_on[]`, `blocks_next`.

---

### Stage 9 — Estimate editorial ROI

**Purpose:** Classify expected value of each roadmap phase.

See Section 13 for ROI model.

**Rule:** No fabricated precise grade gains (e.g., "this will raise you from B to A-"). Use directional language: "likely to address structural gaps blocking query readiness."

---

### Stage 10 — Select next best action

**Purpose:** Identify exactly one highest-value step.

See Section 14.

**Pre-expert default:** When no experts have run, next best action is typically `approve_roadmap` or `approve_team_and_launch_first_expert` — never a vague "keep writing."

---

### Stage 11 — Ask author approval

**Purpose:** Present complete roadmap; obtain author decision before expert access.

See Section 15.

**Presentation question:**

> "Does this roadmap reflect where you want to take your manuscript?"

**Hard rule:** No expert receives manuscript before roadmap approval **and** team sharing permission (constitutional dual gate).

---

## 6. Protected-Strength Model

### Entry schema

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `strength_id` | uuid | Yes | Stable across roadmap versions |
| `disposition` | enum | Yes | `protect` \| `strengthen` \| `improve` \| `reconsider` |
| `category` | enum | Yes | `character_voice`, `dialogue`, `theme`, `suspense`, `humor`, `emotional_climax`, `originality`, `world_building`, `prose_style`, `structure`, `market_hook`, `domain_authenticity`, `other` |
| `label` | string | Yes | Author-facing name |
| `description` | string | Yes | Why this works or matters |
| `evidence_locators` | Locator[] | Yes | Min 1; manuscript text only |
| `protection_level` | enum | Yes | `critical` \| `high` \| `moderate` |
| `identified_by` | enum | Yes | `editor_in_chief` (initial roadmap) |
| `supporting_experts` | string[] | No | Empty at initial roadmap |
| `author_confirmed` | boolean? | No | Set at approval if author affirms |
| `conflicts_with_destination` | boolean | No | For `reconsider` entries |

### Voice rules

| Do | Don't |
|----|-------|
| "Your opening chapter establishes distinct POV rhythm in {locator}" | "Your writing is amazing" |
| "The tactical sequence in {locator} reads authentically at lay reader level" | "This will be a bestseller" |
| "This character dynamic is a manuscript asset worth protecting" | List problems before any strength |

---

## 7. Destination Model

### DestinationBlock schema

| Field | Type | Notes |
|-------|------|-------|
| `intent_type` | enum | Derived from understanding; author confirms |
| `author_success_definition` | string | Verbatim from understanding |
| `destination_label` | string | Plain-English headline |
| `success_criteria` | SuccessCriterion[] | Measurable checkpoints |
| `publication_target` | string | e.g., "Traditional agent query" |
| `timeline_preference` | string? | From understanding/brief |
| `budget_preference` | string? | From understanding/brief |
| `priority_domains` | string[] | From understanding/brief |
| `implicit_constraints` | string[] | From publication state + series context |

### SuccessCriterion schema

| Field | Type | Notes |
|-------|------|-------|
| `criterion_id` | uuid | Stable |
| `label` | string | Author-facing |
| `measurement` | string | How we know it's met |
| `status` | enum | `not_started` \| `in_progress` \| `met` \| `blocked` |
| `evidence_required` | string | What proof satisfies this |

---

## 8. Current-Position Model

### CurrentPositionBlock schema

| Field | Type | Notes |
|-------|------|-------|
| `manuscript_version_label` | string | e.g., "Version 3 — first editorial roadmap" |
| `publication_state` | enum | Constitutional states |
| `series_context` | enum | standalone \| series \| anthology \| shared_universe |
| `current_manuscript_stage` | enum | See Stage 4 |
| `revision_cycle_phase` | enum | `pre_review` \| `roadmap_review` \| `in_review` \| `post_review_revision` \| `query_ready` |
| `narrative_summary` | string | EIC synthesis |
| `understanding_recap` | string | Labeled author-provided |
| `major_strengths` | string[] | Top 3 headlines |
| `material_risks` | RemainingRisk[] | Top risks |
| `author_goal_alignment` | AlignmentBlock | From vision alignment |
| `key_signals` | KeySignal[] | Structured assessment |
| `experts_completed` | string[] | Empty at initial roadmap |
| `experts_pending` | string[] | From recommended sequence |

### AlignmentBlock

| Field | Type |
|-------|------|
| `alignment_level` | `strongly_aligned` \| `substantially_aligned` \| `partially_aligned` \| `materially_misaligned` |
| `explanation` | string |
| `author_stated_vision_summary` | string (labeled) |
| `independent_assessment_summary` | string (labeled) |

---

## 9. Grading Standard

### StoryDNA Editorial Grading Standard (initial roadmap)

Grades assess **current professional readiness for the author's stated destination** — not literary merit in isolation, not comparison to published classics, and not the author's potential.

### Grade definitions

| Grade | Definition | Typical remaining work | Submission/publication suitability |
|-------|------------|------------------------|-----------------------------------|
| **A+** | Exceptional execution; destination-ready with only minor refinement | Line-level polish, copy edits, minor continuity checks | Ready for stated destination pending final proof |
| **A** | Professionally publishable for stated destination | Targeted expert passes; polish; market confirmation | Suitable for submission path stated in destination |
| **A-** | Strong; near professional readiness | One focused revision cycle or 1–2 expert passes | Close; specific gaps identified |
| **B+** | Above average; commercially promising with targeted work | Structural or market positioning passes; domain clearance if applicable | Promising; not yet submission-ready |
| **B** | Solid manuscript; meaningful revision still needed | Developmental or substantial revision cycle; multiple expert domains likely | Not yet suitable for stated destination |
| **B-** | Sound foundation; significant gaps in craft, structure, or alignment | Major revision in 1–2 dimensions | Early-stage for stated destination |
| **C+** | Clear promise; developing execution | Foundational structural and craft work | Not suitable for professional submission |
| **C** | Developing draft with identifiable assets and substantial gaps | Multiple revision cycles | Not suitable |
| **C-** | Early draft with fragments of strength | Extensive developmental work | Not suitable |
| **D** | Major structural/craft failures dominate | Reconceptualization or major rewrite | Not suitable |
| **F** | Manuscript does not yet function as a coherent work for stated destination | Foundational rebuild | Not suitable |

### Formal threshold evaluation (B / B+ / A- / A / A+)

These thresholds were evaluated against constitutional burden of proof and pre-expert evidence constraints:

| Grade | Formal threshold | Evidence requirement |
|-------|------------------|---------------------|
| **B** | Manuscript demonstrates coherent narrative execution with identifiable strengths, but **material gaps** block the stated destination. Author could credibly reach destination with planned editorial work. | ≥2 protected strengths with locators; ≥1 material risk with locator; alignment not `materially_misaligned` |
| **B+** | All B criteria, plus: execution exceeds genre baseline in ≥1 dimension; commercial or craft signals suggest **above-average potential** for destination. | Independent read identifies standout craft or market hook signals with locators |
| **A-** | All B+ criteria, plus: structure and voice are **largely stable**; remaining gaps are targeted, not foundational. One focused cycle could reach A. | No blocking structural risks; ≤3 high-impact opportunities remain |
| **A** | Manuscript meets **professional publishability** for stated destination based on EIC independent read. Remaining work is refinement, not reconstruction. | Alignment ≥ `substantially_aligned`; no blocking risks; publication readiness ≥ `approaching` |
| **A+** | Exceptional on-page execution; destination-ready. Only minor refinement (copy, proof, micro-consistency). | Alignment `strongly_aligned`; ≥3 Protect-level strengths; distance band Very Close |

**Calibration rule:** At initial roadmap, grades above **A-** require `grade_confidence: high` and alignment ≥ `substantially_aligned`. Otherwise cap at A- with explanation.

### Definition of a "good manuscript"

For StoryDNA initial roadmap purposes, a **good manuscript** is:

> **Grade B or above**, with **high confidence** in at least one **Protect**- or **Strengthen**-disposition protected strength, a **defined improvement path** to the next grade band, and **author goal alignment** that is not `materially_misaligned`.

A B manuscript is good — it is solid work with a clear path forward. StoryDNA must communicate this encouragingly. "Good" does not mean "finished."

### GradeBlock schema

| Field | Type |
|-------|------|
| `current_grade` | enum (A+ through F) |
| `definition` | string |
| `rationale` | string |
| `confidence` | `high` \| `medium` \| `low` |
| `evidence` | Locator[] |
| `improvement_path` | string |
| `potential_grade_ceiling` | enum (A+ through F) |
| `ceiling_rationale` | string |

---

## 10. Editorial-Distance Model

### Distance bands

| Band | Score | Approximate revision | Likely phases | Expert involvement | Regression risk | Re-review |
|------|-------|---------------------|---------------|-------------------|-------------------|-----------|
| **Very Close** | 81–100 | Minor polish; copy-level; micro-revisions | 1 | 0–1 confirmation expert | Low | Optional delta review |
| **Close** | 61–80 | Targeted pass in 1–2 dimensions | 1–2 | 1–2 experts | Low–medium | Recommended after revision |
| **Moderate** | 41–60 | Substantial revision in 2–3 dimensions | 2–3 | 2–4 experts | Medium | Required after major revision |
| **Significant** | 21–40 | Major structural or craft rework | 3–4 | 3–5 experts | Medium–high | Required between phases |
| **Extensive** | 0–20 | Foundational rebuild or early-draft development | 4+ | Full sequence | High if order violated | Required after each phase |

### EditorialDistanceBlock schema

| Field | Type |
|-------|------|
| `distance_band` | enum |
| `distance_score` | number 0–100 |
| `revision_magnitude` | `minor` \| `targeted` \| `substantial` \| `major` \| `foundational` |
| `likely_phase_count` | `{ min: number, max: number }` |
| `likely_expert_count` | `{ min: number, max: number }` |
| `regression_risk` | `low` \| `medium` \| `high` |
| `re_review_required` | boolean |
| `re_review_explanation` | string |
| `primary_gaps` | string[] (max 3) |
| `estimation_basis` | string |
| `confidence` | `high` \| `medium` \| `low` |

### Honest estimation rules

| Condition | Requirement |
|-----------|-------------|
| Pre-expert only | Confidence ≤ `medium`; label "Preliminary estimate" |
| No cost/runtime precision | Ranges only unless cost accounting data exists for recommended experts |
| Alignment `materially_misaligned` | Distance band cannot be Very Close or Close |

---

## 11. Expert-Recommendation Model

### ExpertRecommendation schema

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `expert_key` | string | Yes | Registry key |
| `display_name` | string | Yes | Author-facing |
| `tier` | enum | Yes | `required` \| `recommended` \| `optional` \| `experimental` \| `unavailable` |
| `availability_status` | enum | Yes | `available` \| `experimental` \| `unavailable` \| `planned` |
| `certification_status` | enum | Yes | `certified` \| `validated` \| `experimental` \| `planned` |
| `recommendation_reason` | string | Yes | Why this expert for this manuscript |
| `questions_expert_will_answer` | string[] | Yes | Exact questions (min 1) |
| `evidence_creating_need` | Locator[] | Yes | Manuscript signals driving recommendation |
| `expected_value` | string | Yes | Plain-English value statement |
| `estimated_cost_range` | string? | Yes if available | Honest range or "Not yet priced" |
| `estimated_runtime_range` | string? | Yes if available | Honest range |
| `requires_prior_expert` | string? | No | Expert key that must run first |
| `sequence_position` | number? | No | Populated in Stage 8 |

### ExcludedExpert schema

| Field | Type | Notes |
|-------|------|-------|
| `expert_key` | string | |
| `display_name` | string | |
| `exclusion_reason` | string | Why not recommended now |
| `reconsider_when` | string? | Condition that would change recommendation |

### Example questions by expert

| Expert | Example questions |
|--------|-------------------|
| Developmental Editor | "Is the three-act structure sound?", "Do character arcs earn their endings?" |
| Literary Agent | "Is the opening hook agent-competitive?", "What are viable comp titles?" |
| Military Expert | "Are tactical sequences plausible for the stated unit and era?" |
| Continuity Expert | "Does this book honor published series canon?" |

---

## 12. Expert-Sequencing Model

### Core ordering rules

| Rule | Rationale | Dependency |
|------|-----------|------------|
| Developmental before line editing | Structure before prose | Line Editor `requires_prior_expert: developmental_editor` |
| Scene inventory before scene-level review | Coverage before depth | Military V2 scene review after inventory |
| Developmental before Literary Agent (non-query intent) | Commercial assessment on stable structure | LA `requires_prior_expert: developmental_editor` |
| Literary Agent early for query_preparation intent | Hook and positioning are primary | LA may be step 1 for query intent |
| Domain realism before final prose polish | Avoid polishing scenes that may move | ME/CME before Line Editor |
| Continuity/Timeline/Archivist when series ≠ standalone | Constitutional dual review (§3) | Continuity before publication lock |
| Final submission review after major revisions | Confirmation, not discovery | LA delta after revision cycle |
| Author-declined experts removed | §12 author rights | Never in sequence |

### EditorialSequenceStep schema

| Field | Type |
|-------|------|
| `step_order` | number |
| `phase_id` | uuid |
| `expert_key` | string |
| `phase_label` | string |
| `rationale` | string |
| `depends_on` | uuid[] |
| `blocks_next` | boolean |
| `status` | `pending` (initial only) |

### RoadmapPhase schema

| Field | Type |
|-------|------|
| `phase_id` | uuid |
| `phase_order` | number |
| `label` | string |
| `description` | string |
| `experts_in_phase` | string[] |
| `depends_on_phases` | uuid[] |
| `roi_classification` | ROI enum (Stage 9) |
| `estimated_cost_range` | string? |
| `estimated_runtime_range` | string? |

---

## 13. Editorial ROI Model

### ROI classifications

| Classification | Meaning |
|----------------|---------|
| **Essential** | Roadmap cannot reach destination without this phase |
| **High** | Significant improvement toward destination; strong cost/benefit |
| **Moderate** | Valuable but not blocking; may defer if budget constrained |
| **Optional** | Nice-to-have; diminishing returns likely |
| **Not recommended** | Cost exceeds value for stated destination; excluded |

### PhaseROIBlock schema

| Field | Type |
|-------|------|
| `phase_id` | uuid |
| `roi_classification` | enum |
| `expected_improvement` | string (directional, not numeric grade delta) |
| `affected_scope` | string (chapters, domains, dimensions) |
| `estimated_cost_range` | string? |
| `estimated_runtime_range` | string? |
| `depends_on` | uuid[] |
| `confidence` | `high` \| `medium` \| `low` |
| `diminishing_returns_risk` | `low` \| `medium` \| `high` |
| `rationale` | string |

**Forbidden:** "This phase will improve your grade from B to A-" unless supported by post-expert evidence in a **regenerated** roadmap.

---

## 14. Next-Best-Action Model

### Rule

Exactly **one** Next Best Action per initial roadmap. No ties. No numbered alternatives of equal weight.

### NextBestActionBlock schema

| Field | Type | Required |
|-------|------|----------|
| `action_type` | enum | Yes |
| `action` | string | Yes — author-facing headline |
| `reason` | string | Yes — why highest value now |
| `expected_value` | string | Yes |
| `prerequisite` | string? | No |
| `estimated_effort` | enum | Yes — `minutes` \| `hours` \| `days` \| `weeks` |
| `estimated_cost` | string? | No |
| `completion_evidence` | string | Yes — how author knows it's done |
| `unlocks` | string | Yes — what becomes possible afterward |
| `linked_phase_id` | uuid? | No |
| `linked_expert_key` | string? | No |

### Action types (initial roadmap)

| Type | When used |
|------|-----------|
| `approve_roadmap` | Roadmap awaiting approval; author must confirm strategy |
| `approve_team` | Team permission needed before first expert |
| `run_first_expert` | Roadmap approved; launch first sequence step |
| `author_decision` | Destination change or alignment discussion needed |
| `confirm_strengths` | Author should affirm Protect entries before revision |
| `resolve_alignment` | Material misalignment requires author conversation |

### Pre-expert default

When roadmap status is `awaiting_author_review`, Next Best Action is **`approve_roadmap`** unless material misalignment requires `author_decision` first.

---

## 15. Author Approval Model

### Presentation bundle

The EIC presents Stage 11 summary containing:
- Destination + success criteria
- Protected strengths (Protect/Strengthen first)
- Current position narrative
- Grade and readiness (with evidence)
- Editorial distance
- Recommended route (phases)
- Expert team + excluded experts
- Sequence with dependencies
- Time and cost ranges
- Next best action

### Approval question

> "Does this roadmap reflect where you want to take your manuscript?"

### Author actions

| Action | Effect | Regeneration scope |
|--------|--------|-------------------|
| **Approve roadmap** | `author_approval_status → approved`; unlock team permission flow | None |
| **Ask a question** | Conversational thread; EIC responds once (Type A/B/C rules); no status change | None until resolved |
| **Change destination** | Capture new success criteria; may require understanding revisit | Stages 3–10 |
| **Remove expert** | Move expert to excluded with author reason | Stages 7–10 |
| **Add expert** | Add to optional/recommended with author reason | Stages 7–10 |
| **Defer expert** | Move to deferred list; excluded from initial sharing | Stages 7–10 |
| **Revise priorities** | Reorder sequence or ROI weights per author preference | Stages 8–10 |
| **Decline roadmap** | `status → cancelled`; return to goals conversation | Full restart available |

### Dual gate (constitutional)

```
Roadmap approved (this framework)
        AND
Team sharing permission granted (EIC conversational blueprint Stage 7)
        AND
Per-expert launch from Expert Desk (Phase 1B+)
        ▼
Expert receives manuscript
```

No expert receives manuscript after **Remove**, **Decline**, or **Defer** until author re-approves.

---

## 16. Roadmap Contract

### Contract: `storydna_editorial_roadmap@v1`

Initial roadmap uses the platform contract with the following **required fields** for first creation:

| Field | Type | Notes |
|-------|------|-------|
| `contract_version` | string | Always `storydna_editorial_roadmap@v1` |
| `roadmap_id` | uuid | Stable identity |
| `book_id` | uuid | Book identity |
| `manuscript_id` | uuid | Manuscript identity |
| `manuscript_version_id` | uuid | Edition scope |
| `author_brief_id` | uuid | Source brief |
| `editorial_understanding_id` | uuid | Confirmed understanding |
| `independent_read_id` | uuid | EIC independent read |
| `author_intent_id` | uuid? | If derived/activated |
| `status` | enum | `draft` \| `awaiting_author_review` \| `approved` \| `superseded` \| `cancelled` |
| `roadmap_kind` | enum | `initial` \| `regenerated` |
| `destination` | DestinationBlock | Section 7 |
| `destination_success_criteria` | SuccessCriterion[] | Measurable |
| `current_stage` | string | Manuscript stage label |
| `current_position` | CurrentPositionBlock | Section 8 |
| `current_grade` | GradeBlock | Section 9 |
| `grade_confidence` | enum | Mirrors grade block |
| `potential_grade_ceiling` | enum | From GradeBlock |
| `publication_readiness` | ReadinessBlock | |
| `commercial_readiness` | ReadinessBlock | |
| `author_goal_alignment` | AlignmentBlock | |
| `editorial_distance` | EditorialDistanceBlock | Section 10 |
| `protected_strengths` | ProtectedStrength[] | Section 6 |
| `improvement_opportunities` | ImprovementOpportunity[] | Max 7 visible |
| `recommended_experts` | ExpertRecommendation[] | Section 11 |
| `excluded_experts` | ExcludedExpert[] | Section 11 |
| `roadmap_phases` | RoadmapPhase[] | Section 12 |
| `editorial_sequence` | EditorialSequenceStep[] | Section 12 |
| `milestones` | Milestone[] | Initial chain seeded |
| `dependencies` | DependencyEdge[] | Phase/step graph |
| `estimated_cost_range` | string | Honest aggregate |
| `estimated_runtime_range` | string | Honest aggregate |
| `risks` | RemainingRisk[] | Material risks |
| `next_best_action` | NextBestActionBlock | Section 14 |
| `roadmap_confidence` | ConfidenceBlock | Section 19 |
| `author_approval_status` | enum | `pending` \| `approved` \| `declined` \| `revision_requested` |
| `author_approval_at` | timestamp? | |
| `supersedes_roadmap_id` | uuid? | Null for initial |
| `trigger_event` | enum | `initial_creation` for first roadmap |
| `provenance` | ProvenanceBlock | All input artifact IDs |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### Status lifecycle (initial roadmap)

```
draft (synthesis in progress)
    → awaiting_author_review (presentation ready)
        → approved (author approves)
        → cancelled (author declines)
    approved → superseded (new roadmap version replaces)
```

### Relationship to parent framework

[STORYDNA_EDITORIAL_ROADMAP_FRAMEWORK.md](./STORYDNA_EDITORIAL_ROADMAP_FRAMEWORK.md) defines the living roadmap lifecycle with `active` status for post-approval operation. Initial creation uses `awaiting_author_review` and `approved` gates before transitioning to `active` when the first expert completes or upon explicit activation rule in ER-4.

---

## 17. Roadmap Versioning

### Immutability rule

Historical roadmaps are **immutable**. Corrections create new records with `supersedes_roadmap_id` linkage.

### Regeneration triggers (post-initial)

| Trigger | New version? | Scope |
|---------|--------------|-------|
| Expert report adjudicated | Yes | Partial regeneration — opportunities, grade, distance, sequence, next action |
| Author accepts revision | Partial update | Opportunity status, progress |
| Author rejects finding | Partial update | Opportunity deprioritized |
| Revision candidate created | No (unless version change) | Track on revision board |
| Manuscript revision → new version | Yes | Full regeneration |
| Expert re-review (delta) | Yes | Partial |
| Author Intent / destination change | Yes | Full from Stage 3 |
| Publication state change | Yes | Full — constraints change |
| Series canon decision | Yes | Continuity phases, milestones |
| Protected strength disputed | Partial | Strengths + conflict check |
| Author declines next action | Partial | Promote alternative |

### Version chain example

```
Initial Roadmap v1 (approved)
    → Literary Agent review → Roadmap v2 (supersedes v1)
    → Author revision → Roadmap v3
    → Destination change → Roadmap v4
```

Each version preserves: `roadmap_id`, `supersedes_roadmap_id`, `trigger_event`, `provenance`, full snapshot at creation time.

---

## 18. Author-Facing Screen Structure

Route (future): `/studio/books/[bookId]/roadmap/initial`

### 12-section layout (mandatory order)

| # | Section | Content | Ordering rule |
|---|---------|---------|---------------|
| 1 | **Encouraging EIC opening** | 2–3 sentences: EIC voice, manuscript acknowledged, strengths-first framing | Always first |
| 2 | **Your destination** | Destination label, success criteria, timeline/budget preferences | Author goal framing |
| 3 | **What is already working** | Protect + Strengthen entries with evidence | Before problems |
| 4 | **What we should protect** | Protect-disposition entries only; "do not damage" list | Before grade |
| 5 | **Where the manuscript stands** | Current position narrative, alignment, key signals | Grade not yet |
| 6 | **Grade and readiness explanation** | Current grade with rationale, confidence, ceiling, improvement path; publication/commercial readiness | After strengths |
| 7 | **Highest-value opportunities** | Ranked improvement opportunities (max 7) | Constructive tone |
| 8 | **Recommended editorial team** | Expert cards + excluded experts accordion | Full transparency |
| 9 | **Recommended sequence** | Phase timeline with dependencies explained | Plain English |
| 10 | **Estimated time and cost** | Honest ranges with assumptions | No fake precision |
| 11 | **Next Best Action** | Single action card with all required fields | One action only |
| 12 | **Author approval controls** | Approval question + action buttons | Fixed footer |

### Anti-patterns (forbidden)

- Issue dumps or finding lists
- Disconnected expert reports (none exist yet)
- Unexplained letter grades
- Fake precision ("73.2% ready")
- Excessive dashboards or progress rings
- Discouraging openers ("This manuscript has serious problems")
- Arbitrary progress percentages

### Copy template — Section 1 opening

> I've read your manuscript and reviewed what you told me about your goals. Here's my editorial roadmap — what I think is working, what we should protect, and the most valuable path to {destination_label}. This is a strategy, not a verdict. You decide what happens next.

---

## 19. Failure and Uncertainty Handling

### Roadmap confidence

| Field | Type | Notes |
|-------|------|-------|
| `overall_confidence` | `high` \| `medium` \| `low` | |
| `understanding_confidence` | number | From editorial understanding |
| `independent_read_coverage` | `full` \| `sampled` \| `partial` | |
| `evidence_depth` | `strong` \| `adequate` \| `thin` | |
| `gaps_affecting_confidence` | string[] | |
| `pre_expert_limitations` | string[] | Always includes "No specialist review yet" |

**Pre-expert cap:** `overall_confidence` cannot exceed `medium` on initial roadmap.

### Failure modes

| Failure | Handling |
|---------|----------|
| Prohibited input detected | Abort synthesis; `draft` with error; operator log |
| Independent read incomplete | Block creation; show status copy |
| Zero protectable strengths found | Rare; require `Reconsider` entries; lower grade confidence; honest copy: "I couldn't yet identify assets to protect — let's discuss" |
| Material misalignment | Allow creation; Next Best Action → `author_decision`; do not recommend expensive expert sequence until resolved |
| All experts unavailable | Roadmap with `author_decision` next action; honest unavailable labeling |
| Understanding confidence low | Should have been blocked pre-read; if detected, abort |
| Grade evidence thin | Cap grade confidence at `low`; widen distance band uncertainty |

### Uncertainty copy standards

| Condition | UI copy |
|-----------|---------|
| Pre-expert | "This assessment is based on my independent read. Specialist review may refine these estimates." |
| Low grade confidence | "I'm moderately confident in this grade — a Developmental Editor pass would sharpen it." |
| Commercial not assessable | "Commercial readiness requires Literary Agent review — not yet assessed." |
| Wide cost range | "Cost range is approximate until team is finalized." |

---

## 20. Test Plan

### Gate tests

- [ ] Creation blocked when brief not submitted
- [ ] Creation blocked when understanding not confirmed
- [ ] Creation blocked when independent read incomplete
- [ ] Creation blocked when any specialist has manuscript access
- [ ] Prohibited input rejection (expert report injected → abort)

### Stage tests

- [ ] Stage 1 loads only allowed inputs
- [ ] Stage 2 requires ≥2 strengths with locators
- [ ] Stage 2 includes all four disposition categories when applicable
- [ ] Stage 3 success criteria are measurable
- [ ] Stage 4 presentation order enforced (grade not first)
- [ ] Stage 5 grade includes all required fields
- [ ] Stage 5 B/B+/A-/A/A+ thresholds applied per Section 9
- [ ] Stage 6 distance bands match score ranges
- [ ] Stage 7 expert entries include all required fields
- [ ] Stage 7 excluded experts populated with reasons
- [ ] Stage 8 sequence respects dependency rules
- [ ] Stage 9 ROI classifications assigned per phase
- [ ] Stage 10 exactly one next best action
- [ ] Stage 11 all author actions produce correct status transitions

### Contract tests

- [ ] `storydna_editorial_roadmap@v1` validates all required initial fields
- [ ] Status transitions: draft → awaiting_author_review → approved
- [ ] Immutability: approved roadmap not mutated; supersession creates new record
- [ ] Provenance block cites all input artifact IDs

### Constitution conformance tests (§14)

- [ ] Author control: all approval actions work
- [ ] Author Intent: destination from author goals
- [ ] Evidence-first: no grade without locators
- [ ] Expert independence: no expert findings in initial roadmap
- [ ] Published canon protection: constraints reflected
- [ ] Series continuity: mandatory experts in sequence when series
- [ ] Immutable history: version chain preserved
- [ ] Provenance: full audit trail
- [ ] Domain ownership: EIC does not impersonate specialists
- [ ] Certification gates: experimental/unavailable labeled
- [ ] Unified author experience: 12-section screen order
- [ ] Backward compatibility: flags off preserves legacy paths

### Capability propagation tests

- [ ] `cap.eic_initial_roadmap_creation` registered
- [ ] Sub-capability classifications documented with evaluation rationale
- [ ] `npm run governance:capability-check` passes

---

## 21. Acceptance Criteria

1. Framework defines all 11 creation stages with inputs, outputs, and rules.
2. Allowed and prohibited inputs explicitly listed with enforcement behavior.
3. Protected-strength model uses Protect/Strengthen/Improve/Reconsider dispositions.
4. Current-position synthesis order mandates understanding → strengths → protected → opportunities → grade → roadmap.
5. Grading standard defines A+ through F with formal B/B+/A-/A/A+ threshold evaluation.
6. "Good manuscript" defined as B+ with evidence and alignment constraints.
7. Editorial-distance model defines five bands with revision amount, phases, experts, regression risk, re-review.
8. Expert recommendations include all required fields plus excluded experts.
9. Editorial sequence defines dependency rules preventing wasteful order.
10. ROI model classifies Essential through Not recommended without fabricated grade gains.
11. Next Best Action is singular with all required fields.
12. Author approval model defines all eight author actions and dual gate.
13. `storydna_editorial_roadmap@v1` contract lists all required initial fields and statuses.
14. Roadmap versioning defines immutability and regeneration triggers.
15. Author-facing 12-section screen structure defined with anti-patterns.
16. Failure and uncertainty handling includes pre-expert confidence cap.
17. Capability Propagation Review evaluates all nine sub-capabilities with modified classifications documented.
18. `cap.eic_initial_roadmap_creation` registered in CAPABILITY_REGISTRY.json.
19. `npm run governance:capability-check` passes on this document.
20. No runtime code, migrations, schema changes, providers, or workflows in this task.

---

## 22. Implementation Phases

**Design phase only.** No runtime code in IER-0.

| Phase | Scope | Depends on |
|-------|-------|------------|
| **IER-0** | Initial roadmap creation framework (this document) | ER-0, CI-0, Amendment 001 |
| **IER-1** | Input gate + 11-stage synthesis types (`lib/editorial-roadmap/initial/`) | IER-0, CI-5, independent read contract |
| **IER-2** | Deterministic synthesis service (no providers) | IER-1 |
| **IER-3** | Persistence + migration for initial roadmap fields | IER-2, ER-3 |
| **IER-4** | Author-facing 12-section UI | IER-3 |
| **IER-5** | Approval workflow + dual gate integration | IER-4, EIC blueprint Stage 7 |
| **IER-6** | Transition to active roadmap on first expert completion | IER-5, ER-4 |

### Explicitly out of scope for IER-0 through IER-2

- Provider calls for narrative generation (deterministic templates first)
- ML-based grade or distance estimation
- Expert workflow launch from roadmap
- Modifying manuscript content

---

## 23. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| EIC impersonates Literary Agent in grade/commercial assessment | Commercial readiness `not_assessable`; grade labeled "EIC independent read assessment"; no comp-title claims without evidence |
| Grade appears before strengths | Constitutional UI order enforced; Section 18 |
| Protected strengths invented without evidence | Min locator requirement; synthesis abort if zero evidence |
| Overconfident pre-expert distance/grade | Confidence capped at medium; preliminary labeling |
| Author overwhelmed by expert list | Max 7 opportunities; excluded experts explain omissions; sequence in plain English |
| Roadmap feels like another report | 12-section encouraging structure; one next action |
| Expert receives manuscript before approval | Dual gate: roadmap approval + sharing permission |
| Protected-strength propagation confusion | Split classification documented; expert affirmation deferred to ER-6 |
| Initial vs regenerated roadmap status conflict | `roadmap_kind` discriminator; transition rules in Section 16 |
| Fake ROI grade gains | Forbidden in Section 13; test plan enforcement |
| Missing independent read framework doc | Boundaries incorporated from conversational blueprint; standalone doc tracked as follow-up |

---

## Governance

- **Registry:** `cap.eic_initial_roadmap_creation` in [CAPABILITY_REGISTRY.json](../capabilities/CAPABILITY_REGISTRY.json)
- **Parent capability:** `cap.editorial_roadmap` extended via `source_documentation` cross-reference
- **Conformance:** `npm run governance:capability-check -- docs/governance/implementation/EIC_INITIAL_EDITORIAL_ROADMAP_CREATION_FRAMEWORK.md`
- **Constitution:** Complies with §0, §1, §6, §8, §10, §12, §13, §14 and Amendment 001
