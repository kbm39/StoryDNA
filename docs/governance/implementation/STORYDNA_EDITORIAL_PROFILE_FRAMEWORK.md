# StoryDNA Editorial Profile Framework

**Document type:** Platform architecture design (no runtime implementation)  
**Owner:** Kevin Track / StoryDNA Editorial Organization  
**Branch baseline:** `feature/eic-phase-1a-author-intent`  
**Constitution baseline:** v1.0 + Amendment 001 (RATIFIED) + Amendment 002 (RATIFIED)  
**Related artifacts:** [STORYDNA_CONVERSATIONAL_INTELLIGENCE_FRAMEWORK.md](./STORYDNA_CONVERSATIONAL_INTELLIGENCE_FRAMEWORK.md), [STORYDNA_EDITORIAL_ROADMAP_FRAMEWORK.md](./STORYDNA_EDITORIAL_ROADMAP_FRAMEWORK.md), [EIC_INITIAL_EDITORIAL_ROADMAP_CREATION_FRAMEWORK.md](./EIC_INITIAL_EDITORIAL_ROADMAP_CREATION_FRAMEWORK.md), [EIC_CONVERSATIONAL_INTAKE_AND_TEAM_APPROVAL_UX_BLUEPRINT.md](./EIC_CONVERSATIONAL_INTAKE_AND_TEAM_APPROVAL_UX_BLUEPRINT.md)

**Note on source documents:** `EIC_INDEPENDENT_READ_FRAMEWORK.md` does not yet exist as a standalone artifact. Independent-read boundaries are incorporated from [EIC_CONVERSATIONAL_INTAKE_AND_TEAM_APPROVAL_UX_BLUEPRINT.md](./EIC_CONVERSATIONAL_INTAKE_AND_TEAM_APPROVAL_UX_BLUEPRINT.md) §9–§10 and [STORYDNA_CONVERSATIONAL_INTELLIGENCE_FRAMEWORK.md](./STORYDNA_CONVERSATIONAL_INTELLIGENCE_FRAMEWORK.md) §9.

---

## Constitution Compliance

```json
{
  "applicable_sections": ["§0", "§1", "§6", "§8", "§10", "§12", "§13", "§14", "Amendment 001", "Amendment 002"],
  "compliance_explanation": "The Editorial Profile implements §0 Editorial Mission by giving the EIC a structured, evidence-based understanding of manuscript characteristics before recruiting specialists — enabling correct editorial team selection without impersonating experts. §1 Author Intent and confirmed Editorial Understanding remain author-declared framing; the profile classifies what the manuscript demonstrates, not what the author selected. §6 Expert Governance is preserved: the profile records specialist *requirements* derived from demonstrated characteristics; it does not produce retained expert findings, domain judgments, or direct expert recommendations. §8 Report Governance: the profile is orchestration metadata feeding the roadmap and editorial plan; it is not a Unified Finding or disconnected expert report. §10 EIC Governance: the EIC owns profile synthesis after independent read; experts consume profile context post-approval but do not author the pre-expert profile. §12 Author Rights: authors may review, dispute, and defer profile classifications; profile recommendations never mandate creative changes. §13 Burden of Proof: every classification carries manuscript evidence, locators, confidence, and materiality; structural inference alone is insufficient; author pitch and understanding are labeled framing-only inputs. §14 conformance tests defined in Section 16. Amendment 001: capability propagation review completed below. Amendment 002: profile synthesis must meet progressive understanding quality — classifications must reflect demonstrated manuscript characteristics, not echo of author categories.",
  "amendment_required": "No",
  "backward_compatibility_impact": "Additive platform layer. Existing independent read, roadmap, intent, and expert workflows remain when editorial profile flags are off. Profile is a new versioned contract between independent read and initial roadmap creation.",
  "certification_impact": "No expert commercially enabled. Profile synthesis is EIC orchestration only. Specialist requirement levels inform recruitment; they do not enable or launch experts without author approval and existing certification gates."
}
```

---

## Capability Propagation Review

```json
{
  "new_capability_introduced": "Editorial Profile (storydna_editorial_profile@v1)",
  "existing_capability_modified": "EIC independent read output; initial editorial roadmap creation; EIC editorial plan gate; editorial roadmap current position and specialist team blocks",
  "classification": "editor_in_chief_owned",
  "existing_experts_evaluated": ["literary_agent", "military_expert", "developmental_editor", "editor_in_chief"],
  "future_experts_affected": ["line_editor", "character_expert", "continuity_expert", "timeline_expert", "archivist", "combat_medicine_expert", "financial_crimes_expert", "producer", "screenplay_editor"],
  "editor_in_chief_impact": "Primary owner. The EIC synthesizes the Editorial Profile immediately after independent read completes and before any specialist manuscript access. Profile becomes the canonical structured input for roadmap creation, specialist requirement assessment, and editorial sequencing.",
  "platform_impact": "New versioned contract, validation rules, materiality/confidence/evidence models, and lifecycle between independent read and roadmap. Feeds cap.editorial_roadmap, cap.eic_initial_roadmap_creation, and cap.eic_plan_gate.",
  "certification_impact": "No commercial enablement change. Specialist requirement levels are domain-need signals, not expert launch commands. Expert recommendations in roadmap honor existing certification tiers.",
  "propagation_decision": "move_to_editor_in_chief",
  "review_artifact_path": "docs/governance/implementation/STORYDNA_EDITORIAL_PROFILE_FRAMEWORK.md"
}
```

### Sub-capability classifications (reviewed)

| Sub-capability | Classification | Propagation decision | Rationale |
|----------------|----------------|---------------------|-----------|
| Editorial profile synthesis | editor_in_chief_owned | move_to_editor_in_chief | Pre-expert EIC orchestration; not expert judgment |
| Story identity classification | editor_in_chief_owned | move_to_editor_in_chief | Evidence-derived taxonomy from independent read |
| Story engine identification | editor_in_chief_owned | move_to_editor_in_chief | Narrative-mechanism classification; EIC-owned pre-expert |
| Editorial characteristics assessment | editor_in_chief_owned | move_to_editor_in_chief | Craft-level EIC synthesis with evidence |
| Technical characteristics assessment | editor_in_chief_owned | move_to_editor_in_chief | Domain-signal detection; not specialist findings |
| Emotional characteristics assessment | editor_in_chief_owned | move_to_editor_in_chief | Reader-experience signals from manuscript evidence |
| Protected asset identification (profile) | editor_in_chief_owned | move_to_editor_in_chief | Initial identification EIC-owned; expert affirmation deferred to ER-6 |
| Editorial risk identification | editor_in_chief_owned | move_to_editor_in_chief | Pre-expert risk signals with mitigation hooks |
| Specialist requirement levels | editor_in_chief_owned | move_to_editor_in_chief | Domain need assessment — not direct expert recommendation |
| Commercial characteristics (pre-expert) | editor_in_chief_owned | move_to_editor_in_chief | Preliminary market signals only; LA refines post-run |
| Roadmap input bundle | editor_in_chief_owned | move_to_editor_in_chief | Structured feed to roadmap synthesis |
| Profile evidence model | platform_wide | move_to_platform | Shared locator/evidence vocabulary across EIC and experts |
| Profile materiality model | platform_wide | move_to_platform | Shared editorial significance scale |
| Profile confidence model | editor_in_chief_owned | move_to_editor_in_chief | Pre-expert confidence is EIC synthesis metadata |

---

## 1. Vision

The **Editorial Profile** is the EIC's structured, evidence-based understanding of a manuscript **after** the independent read and **before** specialist recommendations.

It answers: *What does this manuscript demonstrably require editorially — based on what is on the page — independent of author-selected categories and independent of specialist opinions?*

### Design north star

| The profile feels like | The profile does NOT feel like |
|------------------------|--------------------------------|
| A professional editor's structured read of the manuscript | The author's genre tags or marketing choices |
| Evidence-backed classification with honest uncertainty | A checklist the author filled out |
| Domain needs explained from demonstrated characteristics | A pre-baked expert bundle or upsell |
| A repeatable, versioned editorial artifact | A one-off chat summary or grade |

### Architectural placement

```
AUTHOR INTENT + MANUSCRIPT BRIEF + CONFIRMED UNDERSTANDING
        │
        │  (framing only — labeled "What you told me")
        ▼
┌───────────────────────────────────────────────────────────────┐
│  EIC INDEPENDENT READ (editor_in_chief_owned)                │
│  - Reads authoritative manuscript                             │
│  - Produces read coverage + vision alignment                  │
│  - Does NOT produce retained expert findings                  │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────┐
│  EDITORIAL PROFILE (editor_in_chief_owned)                    │
│  Story Identity · Story Engine · Editorial/Technical/         │
│  Emotional Characteristics · Protected Assets · Risks ·       │
│  Specialist Requirements · Commercial · Roadmap Inputs        │
└───────────────────────────┬───────────────────────────────────┘
                            │ feeds
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
   Initial Roadmap     EIC Editorial Plan   Expert context
   Creation            (team + sequence)    (post-approval)
```

**Hard boundary:** The Editorial Profile is EIC-synthesized manuscript understanding. It is not an expert report, not a Unified Finding, not Author Intent, and not manuscript evidence itself — it is **structured editorial metadata derived from manuscript evidence**.

**Constitutional ordering:** Profile synthesis may begin only when `storydna_eic_independent_read@v1` status = `complete` and zero specialists have received manuscript bytes for the current version.

---

## 2. Editorial Philosophy

### The profile IS

- **Evidence-first** — every classification cites manuscript locators or honest absence of contrary evidence
- **Independent** — classifications follow demonstrated manuscript characteristics, not author-selected genre tags or marketing categories
- **Explainable** — each entry includes rationale readable in plain English
- **Versioned** — profile evolves with manuscript version; prior profiles preserved append-only
- **Repeatable** — same inputs and rules produce the same classifications (deterministic in Phase 1)
- **Pre-expert** — synthesized before any specialist has reviewed the manuscript

### The profile IS NOT

| Not this | Because |
|----------|---------|
| Author Intent | Intent is author-declared goal; profile is manuscript-demonstrated characteristics |
| Editorial Understanding | Understanding is conversational framing; profile is post-read structural assessment |
| Expert finding | Experts produce immutable domain judgments; EIC classifies orchestration needs |
| Direct expert recommendation | Section 8 records domain *requirements*; roadmap Stage 7 maps requirements to experts |
| A letter grade | Grades appear in roadmap creation; profile supplies inputs, not author-facing grade |
| Marketing copy | Commercial characteristics are preliminary signals with low pre-expert confidence |

### Framing versus evidence (mandatory)

| Input | Role in profile | Label in UI |
|-------|-----------------|-------------|
| Author Intent | Constrains roadmap destination comparison only | "Your goal" |
| Editorial Understanding | Alignment comparison baseline only | "What you told me" |
| Manuscript Brief | Context for alignment; never overrides locators | "Author brief" |
| Manuscript text | Supreme evidence source | "From the manuscript" |
| Independent read output | Primary synthesis input | "EIC independent read" |

**Rule:** Author-stated genre, comp titles, or market category **must not** become profile classifications without independent manuscript evidence supporting them. When author framing and manuscript evidence diverge, profile records both with explicit `alignment_note`.

---

## 3. Contract: `storydna_editorial_profile@v1`

The Editorial Profile is a versioned, append-evolved contract persisted per manuscript edition.

| Field | Type | Notes |
|-------|------|-------|
| `contract_version` | string | Always `storydna_editorial_profile@v1` |
| `profile_id` | uuid | Stable identity |
| `manuscript_id` | uuid | Book identity |
| `manuscript_version_id` | uuid | Edition scope |
| `author_intent_id` | uuid | Destination comparison reference |
| `independent_read_id` | uuid | Source independent read |
| `editorial_understanding_id` | uuid? | Confirmed understanding for alignment |
| `status` | enum | `draft`, `active`, `superseded`, `author_disputed` |
| `supersedes_profile_id` | uuid? | Prior profile linkage |
| `generated_at` | timestamp | Synthesis timestamp |
| `trigger_event` | enum | `independent_read_complete`, `author_dispute_resolved`, `manuscript_version_change` |
| `synthesis_confidence` | ProfileConfidenceBlock | Aggregate profile confidence |
| `story_identity` | StoryIdentityBlock | Section 1 |
| `story_engines` | StoryEngineEntry[] | Section 2 |
| `editorial_characteristics` | EditorialCharacteristicEntry[] | Section 3 |
| `technical_characteristics` | TechnicalCharacteristicEntry[] | Section 4 |
| `emotional_characteristics` | EmotionalCharacteristicEntry[] | Section 5 |
| `protected_assets` | ProtectedAssetEntry[] | Section 6 |
| `editorial_risks` | EditorialRiskEntry[] | Section 7 |
| `specialist_requirements` | SpecialistRequirementEntry[] | Section 8 |
| `commercial_characteristics` | CommercialCharacteristicsBlock | Section 9 |
| `roadmap_inputs` | RoadmapInputsBlock | Section 10 |
| `provenance` | ProvenanceBlock | Input artifact IDs and coverage metadata |
| `is_expert_finding` | boolean | Always `false` |
| `is_manuscript_evidence` | boolean | Always `false` — derived metadata, not raw text |
| `is_author_intent` | boolean | Always `false` |

---

## 4. Profile Structure — Ten Sections

### 4.1 Story Identity

**Purpose:** Classify what kind of story the manuscript **demonstrates** on the page — not what the author labeled it.

| Field | Type | Notes |
|-------|------|-------|
| `primary_identity` | IdentityClassification | Single dominant demonstrated identity |
| `secondary_identities` | IdentityClassification[] | 0–2 supporting identities |
| `identity_rationale` | string | Plain-English explanation |
| `evidence` | EvidenceEntry[] | Minimum 2 locators for primary |
| `confidence` | enum | `high`, `medium`, `low` |
| `author_framing_alignment` | enum | `aligned`, `partially_aligned`, `divergent` |
| `alignment_note` | string? | Required when not `aligned` |

**IdentityClassification structure:**

| Field | Type |
|-------|------|
| `identity_key` | string — controlled vocabulary |
| `label` | string — author-facing name |
| `demonstration_summary` | string — what on the page supports this |

**Controlled vocabulary (initial — extensible via minor amendment):**

| Category family | Example keys |
|-----------------|--------------|
| Genre form | `literary_fiction`, `commercial_thriller`, `romantic_suspense`, `historical_fiction`, `speculative_fiction`, `memoir`, `ya_fiction`, `middle_grade`, `cozy_mystery`, `epic_fantasy`, `contemporary_drama` |
| Format | `standalone_novel`, `series_installment`, `linked_anthology`, `novella`, `short_story_collection` |
| Market lane | `book_club`, `mass_market`, `upmarket`, `niche_genre`, `crossover` |

**Classification rules:**

1. Primary identity must be the **single best fit** from demonstrated craft, structure, and reader promise — not author brief genre field.
2. Secondary identities (max 2) capture hybrid or dual-market signals with independent evidence.
3. If evidence supports multiple identities equally, select primary by **dominant page-time and structural commitment**; record alternates in `alignment_note`.
4. `"unspecified"` is forbidden — use `low` confidence with best-evidence classification instead.
5. Author-selected categories may appear in `alignment_note` but never as `identity_key` without evidence.

---

### 4.2 Story Engine

**Purpose:** Identify the narrative mechanisms driving reader engagement. Multiple engines allowed.

| Field | Type | Notes |
|-------|------|-------|
| `engine_id` | uuid | Stable per engine entry |
| `engine_key` | string | Controlled vocabulary |
| `label` | string | Author-facing name |
| `role` | enum | `primary`, `secondary`, `supporting` |
| `demonstration_summary` | string | How this engine operates on the page |
| `evidence` | EvidenceEntry[] | Minimum 1 locator |
| `confidence` | enum | `high`, `medium`, `low` |
| `materiality` | enum | `critical`, `high`, `moderate`, `low` |

**Engine vocabulary (initial):**

| Engine key | Meaning |
|------------|---------|
| `mystery_engine` | Question-driven propulsion; reveals and concealment |
| `suspense_engine` | Tension through imminent threat or deadline |
| `romance_engine` | Relationship arc drives reader investment |
| `character_engine` | Interior change and decision-making drive narrative |
| `plot_engine` | External events and causality chain drive narrative |
| `theme_engine` | Idea or argument drives structure and scene selection |
| `world_engine` | Setting, culture, or system complexity drives engagement |
| `voice_engine` | Prose style and narrative voice are primary draw |
| `humor_engine` | Comic timing and wit drive reader experience |
| `horror_engine` | Dread, violation, or fear mechanics drive engagement |
| `wonder_engine` | Discovery, awe, or speculative revelation drives engagement |
| `stakes_engine` | Escalating consequences drive scene urgency |

**Rules:**

1. At least one engine required; at most one `primary`.
2. Engines are **not mutually exclusive** — a thriller may have `suspense_engine` + `mystery_engine` + `stakes_engine`.
3. Engines must be derived from scene-level behavior, not back-cover copy.
4. When an engine is `critical` materiality, roadmap must treat damage to that engine as high regression risk.

---

### 4.3 Editorial Characteristics

**Purpose:** Assess craft-level editorial properties that shape revision strategy.

Each entry:

| Field | Type | Notes |
|-------|------|-------|
| `characteristic_id` | uuid | Stable identity |
| `domain` | enum | See domains below |
| `label` | string | Author-facing headline |
| `assessment` | enum | `strength`, `developing`, `gap`, `risk` |
| `summary` | string | What was observed |
| `evidence` | EvidenceEntry[] | Required for `strength`, `gap`, `risk` |
| `confidence` | enum | `high`, `medium`, `low` |
| `materiality` | enum | `critical`, `high`, `moderate`, `low` |

**Domains:**

| Domain | Examples |
|--------|----------|
| `structure` | Act architecture, midpoint, escalation, resolution |
| `pacing` | Scene rhythm, dead zones, rush points |
| `character` | Arc clarity, motivation, ensemble balance |
| `voice` | POV consistency, narrative distance, tone control |
| `dialogue` | Subtext, differentiation, exposition balance |
| `prose` | Clarity, imagery, sentence craft |
| `theme` | Coherence, integration vs. preachiness |
| `opening` | Hook, orientation, promise delivery |
| `ending` | Payoff, resonance, sequel setup (if series) |
| `continuity` | Internal consistency (pre-expert; series flags only) |

**Rules:**

1. Minimum 5 entries spanning at least 3 domains before profile activation.
2. At least 2 entries must be `strength` — profile must not be deficit-only.
3. `risk` assessments require `materiality` ≥ `moderate`.
4. Editorial characteristics are EIC craft assessment — not DE or LA findings.

---

### 4.4 Technical Characteristics

**Purpose:** Identify domain-specific technical content requiring specialist review — with materiality, confidence, evidence, and specialist need per entry.

Each entry:

| Field | Type | Notes |
|-------|------|-------|
| `technical_id` | uuid | Stable identity |
| `domain_key` | string | Controlled domain vocabulary |
| `label` | string | Author-facing description |
| `observation` | string | What the manuscript demonstrates |
| `materiality` | enum | `critical`, `high`, `moderate`, `low`, `negligible` |
| `confidence` | enum | `high`, `medium`, `low` |
| `evidence` | EvidenceEntry[] | Required when materiality ≥ `moderate` |
| `specialist_need` | enum | `critical`, `high`, `medium`, `low`, `none` |
| `specialist_need_rationale` | string | Why this domain need level — not which expert |

**Domain vocabulary (maps to specialist domains, not expert keys):**

| Domain key | Typical specialist domain |
|------------|----------------------------|
| `military_tactics` | Military Expert |
| `combat_medicine` | Combat Medicine Expert |
| `financial_crimes` | Financial Crimes Expert |
| `legal_procedure` | Legal Expert (future) |
| `medical_clinical` | Medical Expert (future) |
| `police_procedure` | Police Procedure Expert (future) |
| `technical_systems` | Technical Consultant (future) |
| `historical_period` | Historical Expert (future) |
| `language_dialect` | Sensitivity / Dialect Expert (future) |
| `series_continuity` | Continuity Expert |
| `timeline_chronology` | Timeline Expert |

**Rules:**

1. `specialist_need` reflects **demonstrated manuscript content**, not author request alone.
2. A domain with no on-page signals → `specialist_need: none` with rationale "No demonstrated {domain} content in independent read coverage."
3. EIC may flag `medium` need from a single high-materiality scene — must cite locator.
4. `specialist_need: critical` requires `materiality: critical` AND `confidence: medium` or higher.
5. Technical characteristics are **not specialist findings** — they are orchestration signals.

---

### 4.5 Emotional Characteristics

**Purpose:** Capture reader emotional experience demonstrated by the manuscript.

Each entry:

| Field | Type | Notes |
|-------|------|-------|
| `emotional_id` | uuid | Stable identity |
| `emotion_key` | string | Controlled vocabulary |
| `label` | string | Author-facing name |
| `intensity` | enum | `dominant`, `present`, `underdeveloped`, `absent` |
| `execution_quality` | enum | `effective`, `uneven`, `ineffective`, `not_assessable` |
| `summary` | string | What the manuscript delivers |
| `evidence` | EvidenceEntry[] | Required when `execution_quality` ≠ `not_assessable` |
| `confidence` | enum | `high`, `medium`, `low` |
| `materiality` | enum | `critical`, `high`, `moderate`, `low` |

**Emotion vocabulary (initial):**

`tension`, `dread`, `hope`, `grief`, `joy`, `romantic_longing`, `righteous_anger`, `moral_ambiguity`, `awe`, `humor`, `catharsis`, `discomfort`, `intimacy`, `loneliness`, `triumph`

**Rules:**

1. Minimum 3 entries; at least 1 `effective` execution.
2. Emotional characteristics inform Protected Assets and Commercial Characteristics — not standalone verdicts.
3. Never infer trauma, identity, or biographical claims about the author from emotional content.

---

### 4.6 Protected Assets

**Purpose:** Identify manuscript elements that must not be damaged during revision — profile-level precursor to roadmap Protected Strengths.

Each entry:

| Field | Type | Notes |
|-------|------|-------|
| `asset_id` | uuid | Stable identity |
| `category` | enum | `voice`, `character`, `scene`, `relationship`, `set_piece`, `theme`, `world`, `dialogue`, `prose`, `humor`, `suspense`, `originality` |
| `label` | string | Specific asset name |
| `description` | string | Why this works |
| `evidence` | EvidenceEntry[] | Minimum 1 locator |
| `protection_level` | enum | `critical`, `high`, `moderate` |
| `linked_engine_id` | uuid? | Story engine this asset powers |
| `linked_emotional_id` | uuid? | Emotional characteristic delivered |
| `confidence` | enum | `high`, `medium`, `low` |

**Rules:**

1. Minimum 2 protected assets before profile activation.
2. Every `critical` asset must link to evidence with `confidence` ≥ `medium`.
3. Protected assets flow to roadmap Stage 2 and expert context injection.
4. Profile protected assets may be **affirmed, challenged, or extended** by experts post-run — expert contributions are separate artifacts.

---

### 4.7 Editorial Risks

**Purpose:** Identify editorial risks that could block destination achievement — with mitigation hooks for roadmap.

Each entry:

| Field | Type | Notes |
|-------|------|-------|
| `risk_id` | uuid | Stable identity |
| `label` | string | Author-facing risk name |
| `description` | string | What could go wrong editorially |
| `severity` | enum | `blocking`, `significant`, `moderate`, `low` |
| `likelihood` | enum | `high`, `medium`, `low` |
| `materiality` | enum | `critical`, `high`, `moderate`, `low` |
| `evidence` | EvidenceEntry[] | Required for `blocking` and `significant` |
| `confidence` | enum | `high`, `medium`, `low` |
| `mitigation_direction` | string | Editorial direction — not implementation steps |
| `blocks_specialist_coverage` | string? | Domain gap this risk exposes |

**Rules:**

1. Risks are editorial — not moral judgments about content.
2. Every `blocking` risk must map to a `specialist_requirement` or `editorial_characteristic` gap.
3. Maximum 10 active risks; remainder collapsed in roadmap synthesis.
4. Risks pair with mitigations in roadmap Remaining Risks section.

---

### 4.8 Specialist Requirements

**Purpose:** Assess domain review need levels from demonstrated manuscript characteristics. **This is NOT a direct expert recommendation.**

Each entry:

| Field | Type | Notes |
|-------|------|-------|
| `requirement_id` | uuid | Stable identity |
| `domain_key` | string | Same vocabulary as technical characteristics |
| `requirement_level` | enum | `critical`, `high`, `medium`, `low`, `none` |
| `justification` | string | Plain-English rationale from demonstrated characteristics |
| `driving_characteristics` | uuid[] | Linked technical/editorial/emotional entry IDs |
| `evidence_summary` | string | Consolidated evidence pointer |
| `confidence` | enum | `high`, `medium`, `low` |
| `author_intent_modifier` | enum | `elevates`, `neutral`, `suppresses`, `not_applicable` |
| `publication_state_modifier` | enum | `mandatory`, `recommended`, `neutral`, `deferred` |
| `series_context_modifier` | enum | `mandatory`, `recommended`, `neutral`, `not_applicable` |

**Level definitions:**

| Level | Meaning | Typical signal |
|-------|---------|----------------|
| **Critical** | Destination or authenticity blocked without domain review | Sustained tactical/medical plot spine; published series canon conflict |
| **High** | Major authenticity or craft gap in domain | Multiple high-materiality technical scenes |
| **Medium** | Domain scenes present; review valuable | Single significant domain set-piece |
| **Low** | Minor domain touchpoints | Background detail only |
| **None** | No demonstrated need | No on-page domain content |

**Hard rules:**

1. **No expert keys in this section** — only domain keys and requirement levels.
2. Roadmap Stage 7 (`Recommend experts`) maps `domain_key` + `requirement_level` → expert recommendations.
3. Author Intent may **elevate** or **suppress** recruitment priority but **cannot invent** domain need without evidence.
4. Published + Series → `series_continuity` and `timeline_chronology` minimum `high` unless standalone with no series signals.
5. `requirement_level: none` entries are required for major domains evaluated — explicit exclusion is honest.

**Example (correct):**

> `domain_key: military_tactics`, `requirement_level: high`, `justification: "Chapters 4, 11, and 19 contain sustained tactical planning and live-fire sequences with operational detail that warrants military authenticity review."`

**Anti-pattern (forbidden):**

> `expert_key: military_expert`, `recommendation: run now` *(direct expert recommendation belongs in roadmap, not profile)*

---

### 4.9 Commercial Characteristics

**Purpose:** Preliminary commercial and market-position signals from independent read — **not** Literary Agent findings.

| Field | Type | Notes |
|-------|------|-------|
| `commercial_assessment_scope` | enum | Always `pre_expert_preliminary` |
| `hook_strength` | enum | `strong`, `developing`, `weak`, `not_assessable` |
| `hook_evidence` | EvidenceEntry[] | Opening chapters primary |
| `comp_alignment_signals` | CompSignal[] | Evidence-derived only — never author comps alone |
| `market_lane_fit` | enum | `clear`, `hybrid`, `unclear`, `not_assessable` |
| `market_lane_rationale` | string | From demonstrated identity + engine |
| `differentiation_signals` | string[] | What distinguishes this manuscript |
| `commercial_risks` | string[] | Preliminary market concerns with evidence |
| `readiness_signal` | enum | `preliminary_promising`, `preliminary_developing`, `preliminary_weak`, `not_assessable` |
| `confidence` | enum | `high`, `medium`, `low` — pre-expert cap: `medium` |
| `author_market_framing_alignment` | enum | `aligned`, `partially_aligned`, `divergent` |

**CompSignal structure:**

| Field | Type |
|-------|------|
| `signal_type` | enum: `tone`, `audience`, `structure`, `theme`, `pace`, `not_comp_claim` |
| `description` | string |
| `evidence` | EvidenceEntry[] |
| `is_author_comp` | boolean — if true, requires evidence confirmation |

**Commercial model rules:**

1. Pre-expert commercial confidence cannot exceed `medium`.
2. Author comp titles are **signals to verify**, not profile facts — `is_author_comp: true` requires manuscript evidence or `divergent` alignment note.
3. EIC must not impersonate Literary Agent voice ("This will sell to Big Five").
4. `not_assessable` is valid and preferred over weak guessing.
5. Literary Agent post-run refines commercial blocks in roadmap regeneration — profile remains historical snapshot.

---

### 4.10 Roadmap Inputs

**Purpose:** Structured bundle feeding initial roadmap creation and editorial plan gate — explicit bridge from profile to roadmap.

| Field | Type | Notes |
|-------|------|-------|
| `destination_alignment` | enum | `strongly_aligned`, `substantially_aligned`, `partially_aligned`, `materially_misaligned` |
| `alignment_source` | string | `vision_alignment` or profile-derived |
| `primary_story_identity_key` | string | From Section 1 |
| `primary_engine_key` | string | From Section 2 |
| `top_protected_asset_ids` | uuid[] | Max 5 for roadmap Stage 2 |
| `top_editorial_risk_ids` | uuid[] | Max 7 for roadmap opportunities |
| `specialist_requirements_summary` | SpecialistRequirementSummary[] | Domain levels for Stage 7 |
| `distance_input_signals` | DistanceInputSignal[] | For editorial distance estimation |
| `readiness_input_signals` | ReadinessInputSignal[] | For grade/readiness Stage 5 |
| `sequencing_hints` | SequencingHint[] | Dependency hints for Stage 8 |
| `roi_hints` | RoiHint[] | Phase value hints for Stage 9 |
| `next_action_hints` | NextActionHint[] | Candidates for Stage 10 — not final NBA |
| `regression_risk` | enum | `low`, `medium`, `high` |
| `coverage_completeness` | number | 0–100 independent read coverage |

**SpecialistRequirementSummary:**

| Field | Type |
|-------|------|
| `domain_key` | string |
| `requirement_level` | enum |
| `priority_rank` | number — 1 = highest |

**DistanceInputSignal:**

| Field | Type |
|-------|------|
| `signal_key` | string |
| `weight` | enum: `high`, `medium`, `low` |
| `direction` | enum: `reduces_distance`, `increases_distance` |
| `source_entry_ids` | uuid[] |

**SequencingHint examples:**

| Hint | Rationale |
|------|-----------|
| `structural_before_prose` | `structure` gap with `materiality: critical` |
| `domain_after_structure` | High military requirement + structural gaps |
| `continuity_early` | Series context + continuity risk |
| `commercial_after_structure` | Query intent + structural soundness prerequisite |

**Rules:**

1. Roadmap Inputs are **hints** — roadmap synthesis may override with documented rationale.
2. Next Best Action is selected in roadmap Stage 10 — profile supplies candidates only.
3. Expert sequencing maps from specialist requirements + editorial characteristics — not author preference alone.

---

## 5. Classification Rules

### General classification invariants

| Rule | Requirement |
|------|-------------|
| Evidence minimum | Primary classifications require ≥2 locators; secondary ≥1 |
| No author category import | Author genre/market tags are comparison inputs only |
| No specialist opinion | Zero expert artifacts permitted in pre-expert profile |
| Deterministic vocabulary | Classifications use controlled keys — free-text labels supplement, not replace |
| Honest uncertainty | Low confidence preferred over false precision |
| Contrary evidence | Required search for high/critical materiality claims |
| Version scope | Profile tied to single `manuscript_version_id` |
| Supersession | New version → new profile; prior preserved |

### Identity versus engine disambiguation

| Question | Answer in section |
|----------|-------------------|
| What kind of book is this? | Story Identity |
| What makes the reader turn pages? | Story Engine |
| How well is craft executed? | Editorial Characteristics |
| What domain expertise does content require? | Technical Characteristics + Specialist Requirements |
| What does the reader feel? | Emotional Characteristics |

### Alignment handling

When author framing diverges from manuscript evidence:

1. Profile classifications follow **manuscript evidence**.
2. Record `author_framing_alignment: divergent` on affected sections.
3. `alignment_note` explains gap without judgment ("Brief describes cozy mystery; manuscript demonstrates thriller pacing and stakes").
4. Roadmap Destination still follows author-declared intent — profile informs **distance**, not goal replacement.

---

## 6. Materiality Model

Materiality measures **editorial significance** — how much a characteristic should drive planning, sequencing, and protection decisions.

### Materiality levels

| Level | Definition | Planning effect |
|-------|------------|-----------------|
| **Critical** | Failure here likely blocks destination or causes major regression | Mandatory roadmap attention; protection priority |
| **High** | Substantial impact on editorial success | Top-quartile opportunity/risk ranking |
| **Moderate** | Meaningful but not blocking | Included in profile; may defer in roadmap |
| **Low** | Minor editorial note | Logged; collapsed in author UI |
| **Negligible** | Technical only — excluded from author-facing summary | Internal completeness only |

### Materiality assignment rules

| Condition | Minimum materiality |
|-----------|---------------------|
| `assessment: risk` in editorial characteristics | `moderate` |
| `severity: blocking` in editorial risks | `critical` |
| Protected asset `protection_level: critical` | `critical` |
| Story engine `role: primary` | `high` |
| Technical domain with sustained page coverage | `high` |
| Single-scene domain touchpoint | `low` maximum |

### Materiality propagation

```
Technical characteristic materiality
        +
Specialist need level
        →
Specialist requirement priority rank
        →
Roadmap sequencing hints
```

Materiality is **independent of confidence** — a low-confidence but critical-materiality item triggers honest uncertainty labeling, not suppression.

---

## 7. Confidence Model

Profile confidence measures **how well the independent read supports each classification** — distinct from expert confidence and conversational understanding confidence.

### Per-entry confidence levels

| Level | Meaning | UI treatment |
|-------|---------|--------------|
| **High** | Multiple locators; consistent signals; contrary evidence searched | State classification directly |
| **Medium** | Adequate locators; minor ambiguity | Classification + brief uncertainty note |
| **Low** | Thin coverage; single-scene inference; partial read | "Preliminary" label; may trigger re-read |

### Aggregate profile confidence (`synthesis_confidence`)

| Field | Type |
|-------|------|
| `overall_confidence` | enum: `high`, `medium`, `low` |
| `independent_read_coverage` | number 0–100 |
| `sections_at_low_confidence` | string[] |
| `evidence_depth` | enum: `strong`, `adequate`, `thin` |
| `gaps_affecting_confidence` | string[] |

**Aggregate rules:**

| Condition | Overall confidence cap |
|-----------|------------------------|
| Independent read coverage < 60% | `low` |
| Any Section 1–2 entry at `low` | `medium` maximum |
| Commercial section | `medium` maximum (pre-expert) |
| 3+ sections at `low` | `low` |

### Confidence versus burden of proof (§13)

| Confidence | Burden of proof status |
|------------|------------------------|
| High | Classification may drive roadmap decisions |
| Medium | Classification drives planning with uncertainty label |
| Low | Classification recorded; roadmap must not treat as confirmed gap |

---

## 8. Evidence Model

Every profile claim must trace to manuscript evidence or an honest statement that contrary evidence was sought and not found.

### EvidenceEntry structure

| Field | Type | Notes |
|-------|------|-------|
| `evidence_id` | uuid | Stable identity |
| `locator` | ManuscriptLocator | Chapter, scene, paragraph, or span |
| `excerpt` | string? | Short quoted text ≤ 50 words |
| `observation` | string | What this evidence demonstrates |
| `polarity` | enum | `supporting`, `contrary`, `neutral` |
| `source` | enum | Always `manuscript` for profile evidence |

**ManuscriptLocator:**

| Field | Type |
|-------|------|
| `chapter_id` | string? |
| `chapter_label` | string |
| `scene_id` | string? |
| `paragraph_range` | string? |
| `word_offset_start` | number? |
| `word_offset_end` | number? |

### Evidence rules

1. **Minimum locators per section** are defined in section specs above.
2. **Contrary evidence search** required before `materiality: critical` or `confidence: high`.
3. Author pitch, understanding, and brief **cannot** serve as `EvidenceEntry.source`.
4. Excerpts must be verbatim from authoritative manuscript version.
5. Evidence entries are immutable once profile is `active`; disputes create new profile version.

### Evidence quality tiers

| Tier | Criteria |
|------|----------|
| Strong | Multiple locators across manuscript; consistent pattern |
| Adequate | 1–2 clear locators; limited contrary evidence |
| Thin | Single-scene inference; warrants low confidence |

---

## 9. Protected Assets (Cross-Section Integration)

Protected Assets (Section 6) integrate signals from:

| Source section | Integration |
|----------------|-------------|
| Story Engine | `linked_engine_id` — asset powers primary engine |
| Emotional Characteristics | `linked_emotional_id` — asset delivers effective emotion |
| Editorial Characteristics | `assessment: strength` may seed protected asset |
| Commercial Characteristics | Strong hook may protect opening scenes |

**Disposition flow to roadmap:**

```
Profile Protected Assets
        →
Roadmap Stage 2 (Protect / Strengthen / Improve / Reconsider)
        →
Expert context injection (do-not-damage list)
```

Minimum 2 protected assets required for profile activation; roadmap requires minimum 2 with at least one `Protect` or `Strengthen`.

---

## 10. Editorial Risks (Cross-Section Integration)

Editorial risks integrate:

| Source | Risk derivation |
|--------|-----------------|
| Editorial Characteristics | `assessment: gap` or `risk` |
| Technical Characteristics | High materiality without specialist coverage plan |
| Emotional Characteristics | `underdeveloped` + `materiality: high` |
| Story Identity alignment | `divergent` author framing |
| Commercial Characteristics | `commercial_risks` with blocking potential |

**Severity mapping:**

| Editorial characteristic | Default risk severity |
|---------------------------|----------------------|
| `gap` + `materiality: critical` | `blocking` |
| `gap` + `materiality: high` | `significant` |
| `risk` + `materiality: moderate` | `moderate` |

---

## 11. Commercial Profile (Section 9 Detail)

The commercial profile is a **pre-expert preliminary market signal block** — not submission readiness certification.

### Commercial assessment boundaries

| EIC may assess pre-expert | EIC may not claim pre-expert |
|---------------------------|------------------------------|
| Opening hook strength with locators | Agent-ready or query-ready verdict |
| Demonstrated market lane from identity | Comp-title match without evidence |
| Differentiation from craft signals | Sales prediction |
| Preliminary readiness signal | Publisher fit |

### Commercial → roadmap mapping

| Profile field | Roadmap field |
|---------------|---------------|
| `readiness_signal` | `commercial_readiness` seed (preliminary band) |
| `hook_strength` | Improvement opportunity candidate |
| `commercial_risks` | Remaining risks |
| `market_lane_fit` | Destination alignment sub-signal |

Post-Literary-Agent roadmap regeneration replaces preliminary commercial bands with expert-informed bands — profile snapshot preserved.

---

## 12. Specialist Requirements (Section 8 Detail)

Specialist requirements are the **bridge between manuscript demonstrated need and expert recruitment** without collapsing into expert recommendation.

### Domain → expert mapping (roadmap Stage 7 only)

| Domain key | Default expert mapping | Notes |
|------------|------------------------|-------|
| `military_tactics` | Military Expert | Experimental tier honored |
| `combat_medicine` | Combat Medicine Expert | Future |
| `financial_crimes` | Financial Crimes Expert | Future |
| `series_continuity` | Continuity Expert | Mandatory when series context |
| `timeline_chronology` | Timeline Expert | Series context |
| `structure` (editorial) | Developmental Editor | From editorial characteristics |
| `commercial` (aggregate) | Literary Agent | From commercial + query intent |

**Profile records domain need. Roadmap records expert recommendation.** Separation is constitutional.

### Modifier interaction

```
base_requirement_level from demonstrated content
        × author_intent_modifier
        × publication_state_modifier
        × series_context_modifier
        →
effective_requirement_level (floored at none, capped at critical)
```

Example: Military content `high` + Author Intent `military_realism` → `critical`. Military content `medium` + Intent `query_preparation` → remains `medium` (intent does not invent content).

---

## 13. Roadmap Integration

### Profile → initial roadmap creation pipeline

| Roadmap stage | Profile input |
|---------------|---------------|
| Stage 1 Gather inputs | `storydna_editorial_profile@v1` as required artifact |
| Stage 2 Protected strengths | Section 6 `protected_assets` |
| Stage 3 Destination | Section 10 `destination_alignment` + author intent |
| Stage 4 Current position | Sections 1–5 summaries + Section 10 signals |
| Stage 5 Grade/readiness | Section 10 `readiness_input_signals` |
| Stage 6 Editorial distance | Section 10 `distance_input_signals` |
| Stage 7 Recommend experts | Section 8 `specialist_requirements` |
| Stage 8 Editorial sequence | Section 10 `sequencing_hints` |
| Stage 9 Editorial ROI | Section 10 `roi_hints` |
| Stage 10 Next best action | Section 10 `next_action_hints` |

### Profile → editorial roadmap contract fields

| Roadmap block | Profile source |
|---------------|----------------|
| `current_position.key_signals` | Editorial + technical characteristics |
| `protected_strengths` | Protected assets |
| `improvement_opportunities` | Editorial risks + characteristic gaps |
| `remaining_risks` | Editorial risks |
| `recommended_editorial_team` | Specialist requirements → expert mapping |
| `editorial_sequence` | Sequencing hints + requirement levels |
| `editorial_distance` | Distance input signals |
| `publication_readiness` | Readiness input signals |
| `commercial_readiness` | Commercial characteristics (preliminary) |
| `provenance` | Profile ID + independent read ID |

### Regeneration after experts run

When experts complete review:

1. Active profile status → `superseded` only on **manuscript version change**.
2. Expert findings **do not mutate** pre-expert profile — they inform **roadmap regeneration** and may produce **profile extension** artifact (future `storydna_editorial_profile@v2` post-expert enrichment — out of EP-0 scope).
3. Pre-expert profile remains immutable historical record of EIC independent assessment.

---

## 14. Profile Lifecycle

### Creation trigger

Profile synthesis begins when:

```
independent_read.status = complete
AND specialist_manuscript_access_count = 0
AND editorial_understanding.status = confirmed
```

### Status lifecycle

| Status | Meaning |
|--------|---------|
| `draft` | Synthesis in progress or failed validation |
| `active` | Current canonical profile for version |
| `superseded` | Replaced by newer profile on same or new version |
| `author_disputed` | Author challenged classifications; resolution pending |

### Author dispute flow

1. Author flags specific entries (identity, engine, requirement level, etc.).
2. Profile → `author_disputed`; EIC presents evidence review.
3. Resolution: author accepts, EIC revises with new locators, or author defers with logged disagreement.
4. Revised profile supersedes disputed version.

### Version evolution

```
Version N independent read complete
        → Profile v1 (active)
        → Initial roadmap created
        → Author approves team
        → Experts run
        → Author revises
Version N+1 independent read complete
        → Profile v2 supersedes v1
        → Roadmap regenerates
```

---

## 15. Future Implementation

**Design phase only.** No runtime code, migrations, or providers in EP-0.

| Phase | Scope | Depends on |
|-------|-------|------------|
| **EP-0** | Framework design + governance (this document) | Amendment 001, independent read boundaries |
| **EP-1** | Contract types, validation, controlled vocabularies (`lib/editorial-profile/`) | EP-0, independent read contract |
| **EP-2** | Profile synthesis service (deterministic rules first) | EP-1, independent read output |
| **EP-3** | Persistence + migration | EP-2 |
| **EP-4** | Wire to initial roadmap creation Stage 1 | EP-3, IER-1 |
| **EP-5** | Author dispute UI + revision flow | EP-4 |
| **EP-6** | Expert context injection (read-only profile summary) | EP-4 + ER-6 |
| **EP-7** | Post-expert profile extension design (`@v2`) | EP-4 + adjudication |

### Explicitly out of scope for EP-0 through EP-2

- Provider-generated classifications without deterministic validation
- Direct expert launch from specialist requirements
- Mutating pre-expert profile with expert findings
- Using author-selected genre as primary identity
- ML-based taxonomy in Phase 1

### Related follow-up artifacts

| Artifact | Status |
|----------|--------|
| `EIC_INDEPENDENT_READ_FRAMEWORK.md` | Not yet standalone — boundaries in UX blueprint |
| `storydna_eic_independent_read@v1` | Referenced; contract detail in roadmap creation framework |
| Post-expert profile enrichment | Deferred to EP-7 |

---

## 16. Acceptance Criteria

1. Framework document defines all 10 profile sections with field-level design.
2. Story Identity requires evidence-derived primary/secondary classification — not author-selected categories.
3. Story Engine allows multiple engines with role and materiality.
4. Technical Characteristics include materiality, confidence, evidence, and specialist need per entry.
5. Specialist Requirements use domain keys and requirement levels — **no direct expert recommendations**.
6. Materiality model defines five levels with planning effects.
7. Confidence model defines per-entry and aggregate rules with pre-expert caps.
8. Evidence model defines EvidenceEntry structure, locator requirements, and contrary evidence rules.
9. Commercial Characteristics are pre-expert preliminary with impersonation boundaries.
10. Roadmap Inputs explicitly map profile sections to initial roadmap creation stages.
11. Profile lifecycle defines creation gate, status transitions, and author dispute flow.
12. `storydna_editorial_profile@v1` contract sketched with required fields and constitutional flags.
13. `cap.editorial_profile` registered in CAPABILITY_REGISTRY.json.
14. `npm run governance:capability-check` passes on this document.
15. No runtime code, migrations, or providers in this design task.

---

## 17. Governance

- **Registry:** `cap.editorial_profile` in [CAPABILITY_REGISTRY.json](../capabilities/CAPABILITY_REGISTRY.json)
- **Conformance:** `npm run governance:capability-check -- docs/governance/implementation/STORYDNA_EDITORIAL_PROFILE_FRAMEWORK.md`
- **Constitution:** Complies with §0, §1, §6, §8, §10, §12, §13, §14, Amendment 001, Amendment 002

---

## Appendix A — Profile Section → Roadmap Stage Map

| Profile section | Primary roadmap consumer |
|-----------------|-------------------------|
| Story Identity | Current Position, Destination alignment |
| Story Engine | Current Position, Protected Assets linkage |
| Editorial Characteristics | Grade/readiness, Improvement Opportunities |
| Technical Characteristics | Specialist Requirements, Sequencing |
| Emotional Characteristics | Protected Assets, Commercial hook |
| Protected Assets | Stage 2 Protected Strengths |
| Editorial Risks | Stage 4 Opportunities, Remaining Risks |
| Specialist Requirements | Stage 7 Expert Recommendations |
| Commercial Characteristics | Commercial Readiness seed |
| Roadmap Inputs | Stages 5–10 aggregated hints |

---

## Appendix B — Specialist Requirement Level → Roadmap Priority

| Requirement level | Default roadmap priority |
|-------------------|-------------------------|
| Critical | Required expert in `required_experts` |
| High | Required or strongly recommended |
| Medium | Recommended with rationale |
| Low | Optional with rationale |
| None | Listed in `excluded_experts` with reason |

---

## Appendix C — Three-Artifact Separation

| Artifact | Question it answers | Authority |
|----------|---------------------|-----------|
| Editorial Understanding | What did the author tell us? | Author framing |
| Editorial Profile | What does the manuscript demonstrate? | EIC independent assessment |
| Editorial Roadmap | What should the author do next? | EIC strategic synthesis |
