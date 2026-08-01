# Feature PRD — StoryDNA Editorial Profile

## Summary

- **Feature name:** StoryDNA Editorial Profile (`storydna_editorial_profile@v1`)
- **Owner:** Kevin Track / StoryDNA Editorial Organization
- **Target phase:** EP-1 through EP-5 (implementation phases per framework)
- **Constitution baseline:** v1.0 + Amendment 001 (RATIFIED) + Amendment 002 (RATIFIED)
- **Source framework:** [STORYDNA_EDITORIAL_PROFILE_FRAMEWORK.md](./STORYDNA_EDITORIAL_PROFILE_FRAMEWORK.md)
- **Related artifacts:** [STORYDNA_CONVERSATIONAL_INTELLIGENCE_FRAMEWORK.md](./STORYDNA_CONVERSATIONAL_INTELLIGENCE_FRAMEWORK.md), [EIC_INITIAL_EDITORIAL_ROADMAP_CREATION_FRAMEWORK.md](./EIC_INITIAL_EDITORIAL_ROADMAP_CREATION_FRAMEWORK.md), [STORYDNA_EDITORIAL_ROADMAP_FRAMEWORK.md](./STORYDNA_EDITORIAL_ROADMAP_FRAMEWORK.md), [EIC_PHASE_1A_AUTHOR_INTENT_PRD.md](./EIC_PHASE_1A_AUTHOR_INTENT_PRD.md)

---

## 1. Document purpose

This PRD operationalizes the [Editorial Profile Framework](./STORYDNA_EDITORIAL_PROFILE_FRAMEWORK.md) into implementable product requirements. It defines what the Editorial Profile **is**, what it **is not**, how it is created, validated, versioned, and consumed — without replacing, weakening, or expanding constitutional requirements.

The Editorial Profile is the EIC's structured, evidence-grounded understanding of a manuscript **after** the independent read and **before** specialist recommendations. It answers: *What does this manuscript demonstrably require editorially — based on what is on the page — independent of author-selected categories and independent of specialist opinions?*

**Scope of this document:** Product requirements, contracts, lifecycle, UX boundaries, acceptance criteria, and implementation sequence. **No runtime code, migrations, or schema changes** are authorized by this PRD alone.

---

## 2. Product context

StoryDNA's constitutional order requires the EIC to read the manuscript independently, synthesize editorial understanding from demonstrated characteristics, and only then recommend specialists. Today, the platform has Author Intent (Phase 1A), manuscript brief intake (Phase 1B-a), conversational editorial understanding (Amendment 002), and initial roadmap creation design — but no versioned artifact that bridges independent read output to roadmap synthesis.

The Editorial Profile fills that gap:

```
Author Intent + Manuscript Brief + Confirmed Understanding  (framing only)
        │
        ▼
EIC Independent Read  (editor_in_chief_owned)
        │
        ▼
Editorial Profile  (editor_in_chief_owned)  ← THIS PRD
        │
        ├──► Initial Editorial Roadmap Creation
        ├──► EIC Editorial Plan Gate (team + sequence)
        └──► Expert context (post-approval, read-only)
```

**Note:** `EIC_INDEPENDENT_READ_FRAMEWORK.md` does not yet exist as a standalone artifact. Independent-read boundaries are incorporated from [EIC_CONVERSATIONAL_INTAKE_AND_TEAM_APPROVAL_UX_BLUEPRINT.md](./EIC_CONVERSATIONAL_INTAKE_AND_TEAM_APPROVAL_UX_BLUEPRINT.md) §9–§10 and [STORYDNA_CONVERSATIONAL_INTELLIGENCE_FRAMEWORK.md](./STORYDNA_CONVERSATIONAL_INTELLIGENCE_FRAMEWORK.md) §9.

---

## 3. Constitutional authority

### Constitution Compliance

```json
{
  "applicable_sections": ["§0", "§1", "§6", "§8", "§10", "§12", "§13", "§14", "Amendment 001", "Amendment 002"],
  "compliance_explanation": "The Editorial Profile implements §0 Editorial Mission by giving the EIC structured, evidence-based manuscript understanding before recruiting specialists. §1 Author Intent and confirmed Editorial Understanding remain author-declared framing; the profile classifies demonstrated manuscript characteristics, not author-selected categories. §6 Expert Governance is preserved: the profile records domain requirements, not retained expert findings or direct expert recommendations. §8 Report Governance: the profile is orchestration metadata feeding roadmap and editorial plan; it is not a Unified Finding or disconnected expert report. §10 EIC Governance: the EIC owns profile synthesis after independent read. §12 Author Rights: authors may review, dispute, and defer profile classifications; profile never mandates creative changes. §13 Burden of Proof: every classification carries manuscript evidence, locators, confidence, and materiality. Amendment 001: capability propagation review completed. Amendment 002: profile synthesis must reflect demonstrated manuscript characteristics, not echo of author categories.",
  "amendment_required": "No",
  "backward_compatibility_impact": "Additive platform layer. Existing independent read, roadmap, intent, and expert workflows remain when editorial profile flags are off. Profile is a new versioned contract between independent read and initial roadmap creation.",
  "certification_impact": "No expert commercially enabled. Profile synthesis is EIC orchestration only. Specialist requirement levels inform recruitment; they do not enable or launch experts without author approval and existing certification gates."
}
```

### What the Editorial Profile IS

| Property | Definition |
|----------|------------|
| Owner | Editor-in-Chief (orchestration synthesis) |
| Timing | After independent read completes; before any specialist manuscript access |
| Evidence basis | Manuscript locators from authoritative version + independent read output |
| Purpose | Structured editorial metadata for roadmap, team planning, and expert context |
| Mutability | Versioned, append-evolved; pre-expert profile immutable once `active` |

### What the Editorial Profile IS NOT

| Not this | Because |
|----------|---------|
| **Author checkboxes** | Classifications are EIC-derived from manuscript evidence, not author self-selection |
| **Unsupported assumptions** | §13 burden of proof; every claim requires locators or honest absence statement |
| **Metadata form** | Not a configuration UI; authors do not fill profile fields |
| **Author-selected experts** | Section 8 records domain *requirements*; roadmap Stage 7 maps to experts |
| **Specialist review** | Pre-expert profile contains zero expert artifacts or domain judgments |
| **Roadmap substitute** | Profile supplies inputs and hints; roadmap owns strategy, grade, NBA, and author approval |
| **Permission to invent facts** | No inference of biography, trauma, identity, or off-page canon |
| **Frozen classification** | Profile evolves on manuscript version change; author dispute triggers revision |

---

## 4. Capability-propagation analysis

### Primary capability review

```json
{
  "new_capability_introduced": "Editorial Profile (storydna_editorial_profile@v1)",
  "existing_capability_modified": "EIC independent read output; initial editorial roadmap creation; EIC editorial plan gate; editorial roadmap current position and specialist team blocks",
  "classification": "editor_in_chief_owned",
  "existing_experts_evaluated": ["literary_agent", "military_expert", "developmental_editor", "editor_in_chief"],
  "future_experts_affected": ["line_editor", "character_expert", "continuity_expert", "timeline_expert", "archivist", "combat_medicine_expert", "financial_crimes_expert", "producer", "screenplay_editor"],
  "editor_in_chief_impact": "Primary owner. EIC synthesizes profile immediately after independent read and before any specialist manuscript access. Profile becomes canonical structured input for roadmap creation, specialist requirement assessment, and editorial sequencing.",
  "platform_impact": "New versioned contract, validation rules, materiality/confidence/evidence models, and lifecycle between independent read and roadmap. Feeds cap.editorial_roadmap, cap.eic_initial_roadmap_creation, and cap.eic_plan_gate.",
  "certification_impact": "No commercial enablement change. Specialist requirement levels are domain-need signals, not expert launch commands.",
  "propagation_decision": "move_to_editor_in_chief",
  "review_artifact_path": "docs/governance/implementation/STORYDNA_EDITORIAL_PROFILE_PRD.md"
}
```

### Capability propagation matrix

| Capability / sub-capability | expert_specific | expert_family | editorial_board_shared | editor_in_chief_owned | platform_wide | Propagation decision |
|-----------------------------|-----------------|---------------|------------------------|----------------------|---------------|---------------------|
| Editorial profile synthesis | — | — | — | **Primary** | — | move_to_editor_in_chief |
| Story identity classification | — | — | — | **Primary** | — | move_to_editor_in_chief |
| Story engine identification | — | — | — | **Primary** | — | move_to_editor_in_chief |
| Editorial characteristics assessment | — | — | — | **Primary** | — | move_to_editor_in_chief |
| Technical characteristics assessment | — | — | — | **Primary** | — | move_to_editor_in_chief |
| Emotional characteristics assessment | — | — | — | **Primary** | — | move_to_editor_in_chief |
| Protected asset identification (pre-expert) | — | — | — | **Primary** | — | move_to_editor_in_chief |
| Editorial risk identification | — | — | — | **Primary** | — | move_to_editor_in_chief |
| Specialist requirement levels | — | — | — | **Primary** | — | move_to_editor_in_chief |
| Commercial characteristics (pre-expert) | — | — | — | **Primary** | — | move_to_editor_in_chief |
| Roadmap input bundle | — | — | — | **Primary** | — | move_to_editor_in_chief |
| Profile evidence model (EvidenceEntry, locators) | — | — | Shared consumption | Primary producer | **Vocabulary owner** | move_to_platform |
| Profile materiality model | — | — | Shared consumption | Primary assigner | **Scale owner** | move_to_platform |
| Profile confidence model | — | — | — | **Primary** | — | move_to_editor_in_chief |
| Author dispute resolution | — | — | — | Primary handler | **Gate owner** | split: EIC-owned synthesis; platform-wide author-rights gate |
| Expert context injection (read-only summary) | Per-expert consumption | — | — | Source artifact | **Policy owner** | defer to EP-6 |

**Experts evaluated and excluded from profile authorship:** Literary Agent, Military Expert, Developmental Editor — profile is pre-expert EIC synthesis; experts consume read-only context post-approval (EP-6).

---

## 5. Product goals

1. Persist a versioned `storydna_editorial_profile@v1` contract per manuscript edition after independent read.
2. Classify demonstrated manuscript characteristics across ten structured sections with evidence, confidence, and materiality.
3. Record domain specialist *requirements* (not expert recommendations) for roadmap Stage 7 mapping.
4. Supply structured roadmap input hints without replacing roadmap synthesis or author approval.
5. Preserve framing-versus-evidence separation: author intent, brief, and understanding inform alignment only.
6. Enable author review, dispute, and deferral without mandating creative changes.
7. Maintain append-only history with supersession on manuscript version change.
8. Gate profile activation on minimum evidence and section completeness thresholds.
9. Integrate with EIC plan gate and initial roadmap creation as required Stage 1 artifact.
10. Meet Amendment 002 quality: classifications reflect demonstrated characteristics, not author category echo.

---

## 6. Non-goals

- Runtime implementation in this PRD task (design/requirements only).
- Provider-generated classifications without deterministic validation (deferred EP-2+).
- Direct expert launch from specialist requirements.
- Mutating pre-expert profile with post-expert findings (deferred EP-7 `@v2` design).
- Using author-selected genre as primary identity without manuscript evidence.
- ML-based taxonomy in Phase 1.
- Replacing or auto-overwriting Author Intent, Editorial Understanding, or manuscript brief contracts.
- Author-facing grade assignment (roadmap owns grade).
- Literary Agent voice impersonation in commercial section.
- Standalone `EIC_INDEPENDENT_READ_FRAMEWORK.md` creation (separate artifact).

---

## 7. Users and responsible editorial roles

| Role | Responsibility |
|------|----------------|
| **Author** | Reviews profile summary; may dispute, defer, or accept classifications; never authors profile fields |
| **Editor-in-Chief** | Synthesizes profile after independent read; presents evidence on dispute; owns activation |
| **Platform operator** | Feature flags, observability, audit access |
| **Specialists (post-approval)** | Read-only profile context injection; may affirm/challenge protected assets in separate artifacts — never mutate pre-expert profile |
| **Literary Agent (post-run)** | Refines commercial bands in roadmap regeneration; does not edit pre-expert profile |

---

## 8. Preconditions

Profile synthesis may begin **only when all** are true:

| Gate | Artifact / state |
|------|------------------|
| Manuscript version authoritative | Current `manuscript_version_id` matches brief and understanding scope |
| Manuscript brief submitted | `storydna_author_manuscript_brief@v1` status = `submitted` (when conversational intake enabled) OR active Author Intent exists (Phase 1A path) |
| Understanding confirmed | `storydna_editorial_understanding@v1` status = `confirmed` |
| Independent read complete | `storydna_eic_independent_read@v1` status = `complete` |
| Zero specialist access | No expert workflow has received manuscript bytes for this version |
| Profile not already active | No conflicting `active` profile for same `(manuscript_id, manuscript_version_id)` unless supersession triggered |

If any gate fails, profile remains in `not_started` or `awaiting_independent_read`.

---

## 9. Trigger and lifecycle

### Triggers

| Trigger event | Action |
|---------------|--------|
| `independent_read_complete` | Begin profile synthesis (`generating`) |
| `manuscript_version_change` | Supersede prior profile; create new profile for new version |
| `peu_understanding_reconfirmed` | Update alignment fields only; do not reclassify without new read |
| `author_dispute_resolved` | Revise disputed entries; supersede disputed version |
| `specialist_findings_complete` | Do **not** mutate pre-expert profile; inform roadmap regeneration only |

### Status state model

| Status | Meaning | Valid transitions |
|--------|---------|-------------------|
| `not_started` | No profile record; gates unmet | → `awaiting_independent_read`, `blocked` |
| `awaiting_independent_read` | Preconditions met except independent read | → `generating`, `blocked` |
| `generating` | Synthesis in progress | → `draft`, `incomplete_evidence`, `failed` |
| `incomplete_evidence` | Synthesis completed but minimum thresholds unmet | → `generating` (re-run), `draft`, `blocked` |
| `draft` | Validated structure; pending EIC review | → `awaiting_eic_confirmation`, `generating`, `failed` |
| `awaiting_eic_confirmation` | EIC reviewing before author exposure | → `active`, `draft`, `failed` |
| `active` | Canonical profile for version | → `updated`, `superseded`, `blocked` |
| `updated` | Active profile with in-place alignment/metadata patch (no classification change) | → `active`, `superseded` |
| `superseded` | Replaced by newer profile | Terminal |
| `blocked` | Author dispute, gate failure, or policy block | → `draft`, `generating`, `superseded` |
| `failed` | Synthesis or validation error | → `generating` |

**Author dispute overlay:** When author disputes classifications on an `active` profile, status → `blocked` with `dispute_reason` metadata. Resolution returns to `active` (accepted), `draft` (EIC revises), or `superseded` (new profile version).

### Lifecycle diagram

```
not_started
    │ gates met
    ▼
awaiting_independent_read
    │ independent read complete
    ▼
generating ──fail──► failed
    │
    ├── thresholds unmet ──► incomplete_evidence
    │
    ▼
draft
    │
    ▼
awaiting_eic_confirmation
    │
    ▼
active ◄──► updated
    │
    ├── author dispute ──► blocked ──► draft / active / superseded
    │
    ├── manuscript version change ──► superseded
    │
    └── (experts run — profile unchanged)
```

---

## 10. Evidence hierarchy (7 levels + conflict rules)

Every profile claim must trace through this hierarchy. Higher levels override lower levels for **classification authority**; lower framing levels inform **alignment comparison only**.

| Level | Source | Role in profile | May classify? |
|-------|--------|-----------------|---------------|
| **L1 — Authoritative manuscript text** | Manuscript version store with locators and verbatim excerpts | Supreme evidence for all classifications | Yes |
| **L2 — EIC independent read observations** | `storydna_eic_independent_read@v1` output | Primary synthesis input derived from L1 | Yes (when grounded in L1) |
| **L3 — Vision alignment output** | `storydna_eic_vision_alignment@v1` (if produced) | Goal-vs-manuscript alignment signals | Yes (alignment fields only) |
| **L4 — Contrary evidence search results** | Mandatory search before high/critical materiality claims | Validates or downgrades confidence | Modifier only |
| **L5 — Confirmed editorial understanding** | `storydna_editorial_understanding@v1` | Comparison baseline — "What you told me" | No — alignment only |
| **L6 — Author manuscript brief** | `storydna_author_manuscript_brief@v1` | Context for alignment — "Author brief" | No — alignment only |
| **L7 — Author intent record** | `storydna_author_intent@v1` | Destination comparison — "Your goal" | No — destination distance only |

### Conflict rules

1. **L1 always wins** over L5–L7 for classification authority.
2. When L5–L7 diverge from L1-supported classifications, record `author_framing_alignment: divergent` and required `alignment_note`; do not adopt author categories without L1 support.
3. L2–L3 cannot override L1 locators; they summarize and interpret L1.
4. L4 is mandatory before assigning `confidence: high` or `materiality: critical`.
5. Absence of L1 evidence for a claim → `confidence: low` minimum; may block activation if section minimums unmet.
6. L5–L7 may **elevate or suppress specialist requirement priority** via modifiers but **cannot invent** domain need without L1/L2 signals.
7. Expert artifacts are **prohibited** at all levels for pre-expert profile synthesis.

---

## 11. Editorial Profile data model (`storydna_editorial_profile@v1`)

### Contract fields

| Field | Type | Notes |
|-------|------|-------|
| `contract_version` | string | Always `storydna_editorial_profile@v1` |
| `profile_id` | uuid | Stable identity |
| `manuscript_id` | uuid | Book identity |
| `manuscript_version_id` | uuid | Edition scope |
| `author_intent_id` | uuid | Destination comparison reference |
| `independent_read_id` | uuid | Source independent read |
| `editorial_understanding_id` | uuid? | Confirmed understanding for alignment |
| `manuscript_brief_id` | uuid? | Brief reference when available |
| `status` | enum | See Section 9 state model |
| `dispute_metadata` | DisputeBlock? | Present when `blocked` for author dispute |
| `supersedes_profile_id` | uuid? | Prior profile linkage |
| `superseded_by_profile_id` | uuid? | Successor linkage |
| `generated_at` | timestamp | Synthesis timestamp |
| `activated_at` | timestamp? | When status became `active` |
| `trigger_event` | enum | `independent_read_complete`, `author_dispute_resolved`, `manuscript_version_change`, `alignment_patch` |
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
| `is_manuscript_evidence` | boolean | Always `false` |
| `is_author_intent` | boolean | Always `false` |

### Shared sub-structures

**EvidenceEntry:**

| Field | Type | Notes |
|-------|------|-------|
| `evidence_id` | uuid | Stable identity |
| `locator` | ManuscriptLocator | Chapter, scene, paragraph, or span |
| `excerpt` | string? | Verbatim ≤ 50 words |
| `observation` | string | What this evidence demonstrates |
| `polarity` | enum | `supporting`, `contrary`, `neutral` |
| `source` | enum | Always `manuscript` for profile evidence |

**ProfileConfidenceBlock:**

| Field | Type |
|-------|------|
| `overall_confidence` | enum: `high`, `medium`, `low` |
| `independent_read_coverage` | number 0–100 |
| `sections_at_low_confidence` | string[] |
| `evidence_depth` | enum: `strong`, `adequate`, `thin` |
| `gaps_affecting_confidence` | string[] |

---

## 12. Required profile sections (all 10 from framework)

Each section below defines: editorial purpose, allowable evidence, required output fields, confidence requirements, uncertainty handling, update behavior, downstream consumers, and prohibited inference behavior.

---

### 12.1 Story Identity

| Dimension | Requirement |
|-----------|-------------|
| **Editorial purpose** | Classify what kind of story the manuscript **demonstrates** on the page — not what the author labeled it |
| **Allowable evidence** | L1 manuscript locators (≥2 for primary); L2 independent read; L3 vision alignment for alignment fields only |
| **Required output fields** | `primary_identity`, `secondary_identities` (0–2), `identity_rationale`, `evidence[]`, `confidence`, `author_framing_alignment`, `alignment_note?` |
| **Confidence requirements** | Primary requires ≥2 locators for `high`; single-locator maximum `medium`; no locators blocks activation |
| **Uncertainty handling** | `"unspecified"` forbidden — use `low` confidence with best-evidence classification; record alternates in `alignment_note` |
| **Update behavior** | Immutable once `active`; dispute or version change creates new profile; alignment-only patch via `updated` status |
| **Downstream consumers** | Roadmap current position, destination alignment, commercial market lane |
| **Prohibited inference** | Importing author genre/market tags as `identity_key` without L1 support; marketing category as demonstrated identity |

---

### 12.2 Story Engine

| Dimension | Requirement |
|-----------|-------------|
| **Editorial purpose** | Identify narrative mechanisms driving reader engagement |
| **Allowable evidence** | L1 scene-level locators (≥1 per engine); L2 read observations |
| **Required output fields** | `engine_id`, `engine_key`, `label`, `role` (`primary`\|`secondary`\|`supporting`), `demonstration_summary`, `evidence[]`, `confidence`, `materiality` |
| **Confidence requirements** | Primary engine requires ≥2 locators for `high`; at least one engine required, at most one `primary` |
| **Uncertainty handling** | Low confidence engines logged; do not omit required engine set — best-evidence classification with preliminary label |
| **Update behavior** | New engines may be added on re-read; role changes require new profile version |
| **Downstream consumers** | Protected assets linkage, roadmap current position, sequencing hints |
| **Prohibited inference** | Engines from back-cover copy or author brief without scene-level L1 behavior |

---

### 12.3 Editorial Characteristics

| Dimension | Requirement |
|-----------|-------------|
| **Editorial purpose** | Assess craft-level editorial properties shaping revision strategy |
| **Allowable evidence** | L1 locators; L2 craft observations; domains: structure, pacing, character, voice, dialogue, prose, theme, opening, ending, continuity |
| **Required output fields** | `characteristic_id`, `domain`, `label`, `assessment` (`strength`\|`developing`\|`gap`\|`risk`), `summary`, `evidence[]`, `confidence`, `materiality` |
| **Confidence requirements** | Minimum 5 entries spanning ≥3 domains; ≥2 `strength` entries; `risk` requires materiality ≥ `moderate` |
| **Uncertainty handling** | `developing` assessment permitted at `low` confidence with thin evidence; `gap`/`risk` at `low` confidence cannot drive roadmap as confirmed gap |
| **Update behavior** | Post-PEU may add alignment notes only; craft reclassification requires new independent read |
| **Downstream consumers** | Roadmap grade/readiness seeds, improvement opportunities, editorial risks derivation |
| **Prohibited inference** | Presenting as DE or LA finding; deficit-only profile (must include strengths) |

---

### 12.4 Technical Characteristics

| Dimension | Requirement |
|-----------|-------------|
| **Editorial purpose** | Identify domain-specific technical content requiring specialist review — orchestration signals, not specialist findings |
| **Allowable evidence** | L1 locators for materiality ≥ `moderate`; L2 domain signal detection |
| **Required output fields** | `technical_id`, `domain_key`, `label`, `observation`, `materiality`, `confidence`, `evidence[]`, `specialist_need`, `specialist_need_rationale` |
| **Confidence requirements** | `specialist_need: critical` requires `materiality: critical` AND `confidence: medium` or higher |
| **Uncertainty handling** | No on-page signals → `specialist_need: none` with explicit rationale |
| **Update behavior** | Domain entries append-only within version; version change supersedes |
| **Downstream consumers** | Specialist requirements (Section 8), roadmap sequencing |
| **Prohibited inference** | Domain need from author request alone; presenting as specialist judgment |

---

### 12.5 Emotional Characteristics

| Dimension | Requirement |
|-----------|-------------|
| **Editorial purpose** | Capture reader emotional experience demonstrated by the manuscript |
| **Allowable evidence** | L1 locators when `execution_quality` ≠ `not_assessable` |
| **Required output fields** | `emotional_id`, `emotion_key`, `label`, `intensity`, `execution_quality`, `summary`, `evidence[]`, `confidence`, `materiality` |
| **Confidence requirements** | Minimum 3 entries; ≥1 `effective` execution |
| **Uncertainty handling** | `not_assessable` valid when coverage insufficient; does not block activation if minimum met elsewhere |
| **Update behavior** | Links to protected assets; immutable per active profile |
| **Downstream consumers** | Protected assets, commercial hook signals |
| **Prohibited inference** | Trauma, identity, or biographical claims about the author from emotional content |

---

### 12.6 Protected Assets

| Dimension | Requirement |
|-----------|-------------|
| **Editorial purpose** | Identify manuscript elements that must not be damaged during revision — precursor to roadmap Protected Strengths |
| **Allowable evidence** | L1 locators (≥1 per asset); links to story engine and emotional characteristics |
| **Required output fields** | `asset_id`, `category`, `label`, `description`, `evidence[]`, `protection_level`, `linked_engine_id?`, `linked_emotional_id?`, `confidence` |
| **Confidence requirements** | Minimum 2 assets for activation; `critical` protection requires confidence ≥ `medium` |
| **Uncertainty handling** | Single-scene asset permitted at `moderate` protection with `low` confidence — flagged in author UI |
| **Update behavior** | Expert affirmation/challenge deferred to separate post-expert artifacts (EP-6); pre-expert entries immutable |
| **Downstream consumers** | Roadmap Stage 2, expert context do-not-damage list |
| **Prohibited inference** | Protecting elements without L1 evidence; author-stated favorites without demonstrated craft strength |

---

### 12.7 Editorial Risks

| Dimension | Requirement |
|-----------|-------------|
| **Editorial purpose** | Identify editorial risks that could block destination achievement — with mitigation hooks |
| **Allowable evidence** | L1 locators required for `blocking` and `significant` severity |
| **Required output fields** | `risk_id`, `label`, `description`, `severity`, `likelihood`, `materiality`, `evidence[]`, `confidence`, `mitigation_direction`, `blocks_specialist_coverage?` |
| **Confidence requirements** | Maximum 10 active risks; every `blocking` risk must map to specialist requirement or editorial characteristic gap |
| **Uncertainty handling** | Risks at `low` confidence labeled preliminary; cannot appear in roadmap as confirmed blocking without medium+ confidence |
| **Update behavior** | Derived from editorial/technical/emotional gaps; revision on dispute |
| **Downstream consumers** | Roadmap opportunities, remaining risks, sequencing hints |
| **Prohibited inference** | Moral judgments about content; risks without editorial framing |

---

### 12.8 Specialist Requirements

| Dimension | Requirement |
|-----------|-------------|
| **Editorial purpose** | Assess domain review need levels from demonstrated characteristics — **NOT direct expert recommendation** |
| **Allowable evidence** | Aggregated from technical/editorial/emotional entries; L1-backed `driving_characteristics` |
| **Required output fields** | `requirement_id`, `domain_key`, `requirement_level`, `justification`, `driving_characteristics[]`, `evidence_summary`, `confidence`, `author_intent_modifier`, `publication_state_modifier`, `series_context_modifier` |
| **Confidence requirements** | `none` entries required for major domains evaluated; published + series → `series_continuity` and `timeline_chronology` minimum `high` unless standalone |
| **Uncertainty handling** | Effective level = base × modifiers, floored at `none`, capped at `critical`; intent cannot invent content |
| **Update behavior** | Recomputed on profile regeneration only |
| **Downstream consumers** | Roadmap Stage 7 expert mapping, EIC plan gate |
| **Prohibited inference** | **No expert keys in this section**; direct "run now" recommendations; author-selected expert list as requirement source |

---

### 12.9 Commercial Characteristics

| Dimension | Requirement |
|-----------|-------------|
| **Editorial purpose** | Preliminary commercial and market-position signals — not Literary Agent findings |
| **Allowable evidence** | L1 opening-chapter locators; L2 hook assessment; comp signals require L1 confirmation |
| **Required output fields** | `commercial_assessment_scope` (always `pre_expert_preliminary`), `hook_strength`, `hook_evidence[]`, `comp_alignment_signals[]`, `market_lane_fit`, `market_lane_rationale`, `differentiation_signals[]`, `commercial_risks[]`, `readiness_signal`, `confidence`, `author_market_framing_alignment` |
| **Confidence requirements** | Pre-expert cap: `medium` maximum; `not_assessable` preferred over weak guessing |
| **Uncertainty handling** | Author comps are signals to verify (`is_author_comp: true` requires L1 confirmation or divergent note) |
| **Update behavior** | Historical snapshot preserved; LA post-run refines roadmap commercial bands |
| **Downstream consumers** | Roadmap commercial readiness seed, improvement opportunities |
| **Prohibited inference** | Agent-ready verdict; sales prediction; publisher fit claims; impersonating Literary Agent voice |

---

### 12.10 Roadmap Inputs

| Dimension | Requirement |
|-----------|-------------|
| **Editorial purpose** | Structured bundle feeding initial roadmap creation — explicit bridge, not roadmap itself |
| **Allowable evidence** | Derived from Sections 1–9; no independent L5–L7 classification |
| **Required output fields** | `destination_alignment`, `alignment_source`, `primary_story_identity_key`, `primary_engine_key`, `top_protected_asset_ids`, `top_editorial_risk_ids`, `specialist_requirements_summary[]`, `distance_input_signals[]`, `readiness_input_signals[]`, `sequencing_hints[]`, `roi_hints[]`, `next_action_hints[]`, `regression_risk`, `coverage_completeness` |
| **Confidence requirements** | Hints inherit lowest confidence of source entries; low-confidence hints flagged `preliminary: true` |
| **Uncertainty handling** | Roadmap synthesis may override hints with documented rationale |
| **Update behavior** | Regenerated with profile; NBA selection deferred to roadmap Stage 10 |
| **Downstream consumers** | Initial roadmap creation Stages 1–10, EIC plan gate |
| **Prohibited inference** | Presenting hints as final roadmap decisions; author preference alone as sequencing authority |

---

## 13. Confidence, uncertainty, conflicting evidence

### Per-entry confidence

| Level | Meaning | UI treatment |
|-------|---------|--------------|
| **High** | Multiple locators; consistent signals; contrary evidence searched | State classification directly |
| **Medium** | Adequate locators; minor ambiguity | Classification + brief uncertainty note |
| **Low** | Thin coverage; single-scene inference | "Preliminary" label; may trigger re-read recommendation |

### Aggregate rules

| Condition | Overall confidence cap |
|-----------|------------------------|
| Independent read coverage < 60% | `low` |
| Any Section 1–2 entry at `low` | `medium` maximum |
| Commercial section | `medium` maximum (pre-expert) |
| 3+ sections at `low` | `low` |

### Conflicting evidence handling

1. Record contrary evidence as `polarity: contrary` entries — do not suppress.
2. When supporting and contrary evidence balance, downgrade confidence one level.
3. Classification follows preponderance of L1 evidence; note conflict in `alignment_note` or entry `summary`.
4. Author framing vs manuscript divergence → `author_framing_alignment: divergent`; profile follows manuscript.
5. Low-confidence classifications are recorded but **must not** drive roadmap as confirmed gaps.

---

## 14. Progressive updating rules

| Event | Profile update scope |
|-------|---------------------|
| PEU understanding reconfirmed | Alignment fields and `roadmap_inputs.destination_alignment` only; status → `updated` |
| Manuscript version change | Full regeneration; prior → `superseded` |
| Author dispute resolved (accept) | No change; `blocked` → `active` |
| Author dispute resolved (EIC revises) | New profile version with new locators; prior → `superseded` |
| Author dispute resolved (defer) | Logged disagreement; profile remains `active` with `deferred_disputes[]` metadata |
| Specialist findings complete | **No mutation** of pre-expert profile; roadmap regenerates |
| Independent read partial re-run | Targeted section regeneration only with new `independent_read_id` |

Amendment 002 compliance: profile updates after PEU must not merely echo new author categories — reclassification requires new L1/L2 evidence from read coverage.

---

## 15. Author Intent relationship

| Aspect | Rule |
|--------|------|
| Role | Destination comparison reference — "Your goal" |
| May influence | `author_intent_modifier` on specialist requirements; destination alignment in roadmap inputs |
| May not influence | Story identity, engines, or technical domain need without L1 evidence |
| Contract link | `author_intent_id` required on profile |
| UI label | "Your goal" — never merged with profile classifications |
| Example | Military realism intent elevates existing military content requirement; cannot create requirement without on-page signals |

---

## 16. Independent Read relationship

| Aspect | Rule |
|--------|------|
| Role | Primary synthesis input — "EIC independent read" |
| Contract link | `independent_read_id` required; profile blocked until read `complete` |
| Coverage dependency | `synthesis_confidence.independent_read_coverage` copied from read output |
| Boundary | Independent read does not produce retained expert findings; profile inherits that boundary |
| Re-read trigger | Coverage < 60% or 3+ sections at low confidence → recommend partial/full re-read before activation |

---

## 17. EIC responsibilities

1. Synthesize profile deterministically from allowed inputs after independent read.
2. Enforce evidence hierarchy and prohibited input rules at synthesis time.
3. Review draft profile before author exposure (`awaiting_eic_confirmation`).
4. Present evidence on author dispute without defensiveness or judgment.
5. Map specialist requirements to expert recommendations only in roadmap Stage 7 — never in profile.
6. Request author consent before any specialist manuscript access (separate gate).
7. Preserve pre-expert profile as immutable historical record after activation.
8. Label all author-facing copy with framing vs evidence distinction.
9. Abort synthesis to `failed` on prohibited input detection.
10. Honest uncertainty: prefer `low` confidence over false precision.

---

## 18. Specialist recommendation logic

**Profile records domain need. Roadmap records expert recommendation.** Separation is constitutional.

### Profile stage (Section 8)

- Output: `domain_key` + `requirement_level` + justification
- Modifiers: `author_intent_modifier`, `publication_state_modifier`, `series_context_modifier`
- **No expert keys**

### Roadmap Stage 7 (downstream — not profile scope)

| Domain key | Default expert mapping |
|------------|------------------------|
| `military_tactics` | Military Expert |
| `combat_medicine` | Combat Medicine Expert |
| `financial_crimes` | Financial Crimes Expert |
| `series_continuity` | Continuity Expert |
| `timeline_chronology` | Timeline Expert |
| `structure` (editorial) | Developmental Editor |
| `commercial` (aggregate) | Literary Agent |

Expert recommendations honor certification tiers with honest unavailable/experimental labeling.

---

## 19. Author consent and manuscript-sharing gate

| Gate | Requirement |
|------|-------------|
| Profile activation | Does **not** grant specialist manuscript access |
| Team recommendation | Roadmap Stage 7 + author approval required |
| Manuscript sharing | Explicit author permission before any expert workflow receives bytes |
| Profile visibility | Author may review profile summary before team approval decision |
| Decline path | Author may defer or decline expert team without profile deletion |

Profile synthesis completes in a **pre-sharing** editorial phase. Zero specialists have manuscript access at profile activation.

---

## 20. Editorial Roadmap integration

### Profile → initial roadmap creation

| Roadmap stage | Profile input |
|---------------|---------------|
| Stage 1 Gather inputs | `storydna_editorial_profile@v1` as **required artifact** |
| Stage 2 Protected strengths | Section 6 `protected_assets` |
| Stage 3 Destination | Section 10 `destination_alignment` + author intent |
| Stage 4 Current position | Sections 1–5 summaries + Section 10 signals |
| Stage 5 Grade/readiness | Section 10 `readiness_input_signals` |
| Stage 6 Editorial distance | Section 10 `distance_input_signals` |
| Stage 7 Recommend experts | Section 8 `specialist_requirements` |
| Stage 8 Editorial sequence | Section 10 `sequencing_hints` |
| Stage 9 Editorial ROI | Section 10 `roi_hints` |
| Stage 10 Next best action | Section 10 `next_action_hints` (candidates only) |

### Distinction

| Artifact | Question | Authority |
|----------|----------|-----------|
| Editorial Profile | What does the manuscript demonstrate? | EIC independent assessment |
| Editorial Roadmap | What should the author do next? | EIC strategic synthesis + author approval |

---

## 21. Protected Assets behavior

1. Minimum 2 protected assets required for profile activation.
2. Every `critical` asset requires evidence with confidence ≥ `medium`.
3. Assets link to story engines and emotional characteristics where applicable.
4. Profile assets flow to roadmap Stage 2 (Protect / Strengthen / Improve / Reconsider).
5. Expert context injection receives do-not-damage list (EP-6).
6. Post-expert: experts may affirm, challenge, or extend in **separate artifacts** — pre-expert profile unchanged.
7. Author may dispute asset classification via dispute flow.

---

## 22. Editorial Risks behavior

1. Risks are editorial — not moral content judgments.
2. Every `blocking` risk maps to specialist requirement or editorial characteristic gap.
3. Maximum 10 active risks; overflow collapsed in roadmap synthesis.
4. Risks pair with mitigations in roadmap Remaining Risks section.
5. Severity derived from editorial characteristic assessments per framework mapping.
6. Author sees risk summary with evidence; may defer disagreement without blocking roadmap review.

---

## 23. Author-facing experience

### What authors see

- Plain-English profile summary organized by section
- Evidence excerpts with chapter/scene locators for key classifications
- Framing labels: "Your goal," "What you told me," "From the manuscript," "EIC independent read"
- Confidence indicators: direct statement (high), brief note (medium), "Preliminary" (low)
- Alignment notes when author framing diverges from manuscript evidence
- Dispute action per section or entry
- Status line: "No experts have received your manuscript"

### What authors do NOT see

- Expert keys or recruitment commands in profile
- Internal domain keys or controlled vocabulary raw values
- Deficit-only presentation (strengths shown first per roadmap philosophy)
- Grade or next-best-action (roadmap owns these)
- Provider model names or synthesis internals

### Required copy (profile presentation)

> This is my professional read of what's on the page — based on the manuscript itself, not the categories you selected. Your goals help me measure distance; they don't override what the text demonstrates. No specialist has reviewed your manuscript yet.

---

## 24. Internal EIC-facing experience

- Full contract view with all fields, locators, and confidence metadata
- Synthesis validation errors with section-level diagnostics
- Prohibited input alerts
- Draft → confirmation workflow before author exposure
- Dispute queue with evidence review tools
- Coverage completeness meter from independent read
- Override requires documented rationale (audit logged)
- Linkage to source artifacts (intent, understanding, brief, read)

---

## 25. Explainability requirements

1. Every classification includes plain-English `rationale` or `summary` readable without editorial jargon.
2. Evidence entries include locator + optional excerpt + observation.
3. Confidence level visible to author for primary identity, primary engine, and blocking risks.
4. Alignment notes explain framing divergence without judgment.
5. Specialist requirement justifications cite demonstrated content, not expert availability.
6. Aggregate `synthesis_confidence.gaps_affecting_confidence` surfaced when overall confidence ≤ `medium`.
7. Audit trail links profile entries to source entry IDs in `driving_characteristics`.

---

## 26. Prohibited behaviors

1. Author self-classification or genre checkbox UI for profile fields.
2. Importing author-selected categories as `identity_key` without L1 evidence.
3. Expert keys in specialist requirements section.
4. Direct expert launch from profile synthesis or UI.
5. Mutating active pre-expert profile with post-expert findings.
6. Using brief, understanding, or intent as `EvidenceEntry.source`.
7. Impersonating Literary Agent voice in commercial section.
8. Inferring author biography, trauma, or identity from content.
9. Presenting profile as roadmap, grade, or next-best-action.
10. Silent incorporation of expert artifacts from prior versions as current evidence.
11. Structural inference alone for high/critical materiality without locators.
12. Omitting contrary evidence search before high-confidence claims.

---

## 27. Failure and incomplete-evidence states

| State | Condition | Recovery |
|-------|-----------|----------|
| `incomplete_evidence` | Section minimums unmet (e.g., <5 editorial characteristics, <2 protected assets) | Re-run synthesis after extended read coverage |
| `failed` | Validation error, prohibited input, or synthesis exception | Fix inputs; retry `generating` |
| `blocked` | Author dispute unresolved or policy gate | EIC review → revise or defer |
| Low aggregate confidence | Coverage < 60% or 3+ low sections | Recommend re-read; may activate with `preliminary` banner |
| Missing independent read | Gate failure | Remain `awaiting_independent_read` |

Author-facing incomplete state copy:

> I need a bit more coverage of your manuscript before I can stand behind these classifications. I'll continue my read and update this profile when I have stronger evidence.

---

## 28. Versioning and provenance

- One `active` profile per `(manuscript_id, manuscript_version_id)` at a time.
- Manuscript version change → new profile; prior → `superseded`.
- `provenance` block records: `author_intent_id`, `independent_read_id`, `editorial_understanding_id`, `manuscript_brief_id`, coverage metadata, synthesis timestamp.
- Evidence entries immutable once profile `active`; disputes create new profile version.
- `supersedes_profile_id` / `superseded_by_profile_id` chain preserved append-only.
- Contract version `storydna_editorial_profile@v1` until EP-7 post-expert enrichment design.

---

## 29. Auditability

1. All status transitions logged with actor, timestamp, and trigger event.
2. Dispute metadata: disputed entry IDs, author reason, resolution outcome.
3. EIC confirmation logged before `active` transition.
4. Prohibited input detection logged with input artifact type (not content).
5. Override rationales persisted when EIC adjusts draft before confirmation.
6. Append-only history queryable by `manuscript_version_id`.
7. No brief or understanding body in same log line as manuscript extracted text.

---

## 30. Feature-flag and commercial-enablement expectations

| Flag | Default | Production | Purpose |
|------|---------|------------|---------|
| `STUDIO_EDITORIAL_PROFILE_ENABLED` | off | unavailable | Master gate for profile synthesis and UI |
| `STUDIO_EIC_ENABLED` | off | unavailable | Required parent EIC flag |
| `STUDIO_AUTHOR_INTENT_ENABLED` | off | unavailable | Required for intent linkage |
| `STUDIO_EIC_CONVERSATIONAL_INTAKE` | off | unavailable | Brief/understanding path when enabled |

**Activation rule:**

```
STUDIO_EDITORIAL_PROFILE_ENABLED=1
AND STUDIO_EIC_ENABLED=1
AND (active Author Intent OR submitted manuscript brief)
AND confirmed editorial understanding
AND complete independent read
```

When flags off: no profile synthesis; initial roadmap creation uses legacy input path (if any) without profile artifact requirement.

**Commercial enablement:** None. Profile does not enable, certify, or launch any expert.

---

## 31. Security and manuscript-access considerations

- Profile stored with same manuscript ownership ACL as intent and understanding records.
- Only manuscript owner and authorized operators may view full profile.
- Expert roles receive read-only summary post-approval only (EP-6) — not during synthesis.
- Profile JSON must not embed full manuscript text — locators and ≤50-word excerpts only.
- Server actions require `requireStudioAccess` and author ownership validation.
- No profile content in provider prompts until explicit independent read phase (separate contract).
- RLS policies (implementation phase) scope by `manuscript_id` owner.

---

## 32. Observability requirements

| Event | Properties |
|-------|------------|
| `editorial_profile.synthesis_started` | `manuscript_id`, `manuscript_version_id`, `independent_read_id` |
| `editorial_profile.synthesis_completed` | `profile_id`, `status`, `overall_confidence`, `duration_ms` |
| `editorial_profile.validation_failed` | `profile_id`, `error_code`, `section` |
| `editorial_profile.activated` | `profile_id`, `eic_confirmed_by` |
| `editorial_profile.disputed` | `profile_id`, `disputed_entry_ids[]` |
| `editorial_profile.superseded` | `profile_id`, `supersedes_profile_id`, `trigger_event` |
| `editorial_profile.incomplete_evidence` | `profile_id`, `gaps[]` |

Metrics: synthesis success rate, activation latency, dispute rate, low-confidence profile rate, section validation failure counts.

---

## 33. Functional requirements

| ID | Requirement |
|----|-------------|
| FR-01 | System creates profile record when independent read completes and all gates pass |
| FR-02 | Synthesis produces all 10 sections conforming to framework field specs |
| FR-03 | Validation rejects profiles missing section minimums |
| FR-04 | Validation rejects expert keys in specialist requirements |
| FR-05 | Validation rejects author framing as evidence source |
| FR-06 | Status transitions follow Section 9 state model |
| FR-07 | EIC confirmation required before `active` |
| FR-08 | Author may dispute entries on active profile → `blocked` |
| FR-09 | Dispute resolution creates superseding profile or logs deferral |
| FR-10 | Manuscript version change supersedes active profile |
| FR-11 | Initial roadmap Stage 1 requires active profile when flag enabled |
| FR-12 | Roadmap inputs populated from profile sections |
| FR-13 | PEU update patches alignment only — no silent reclassification |
| FR-14 | Feature flags off preserve legacy behavior without profile |
| FR-15 | Prohibited input aborts synthesis to `failed` |
| FR-16 | Pre-expert profile immutable after activation |
| FR-17 | Author UI shows framing/evidence labels per section |
| FR-18 | Commercial confidence capped at `medium` pre-expert |

---

## 34. Non-functional requirements

| ID | Requirement |
|----|-------------|
| NFR-01 | Deterministic synthesis: same inputs + rules → same classifications (Phase 1) |
| NFR-02 | Synthesis completes within 60s for typical manuscript (excluding read time) |
| NFR-03 | Profile contract validated against JSON schema before persistence |
| NFR-04 | Append-only history — no destructive deletes |
| NFR-05 | WCAG AA for author-facing profile summary |
| NFR-06 | All status transitions auditable |
| NFR-07 | No profile body in production info logs |
| NFR-08 | Backward compatible when flags off |

---

## 35. Acceptance criteria (objective/measurable)

1. Profile contract includes all fields in Section 11 with constitutional flags `is_expert_finding: false`, `is_manuscript_evidence: false`, `is_author_intent: false`.
2. Story Identity primary classification requires ≥2 L1 locators — test rejects single-locator high confidence.
3. Specialist Requirements contain zero expert keys — test scans all entries.
4. Minimum 5 editorial characteristics across ≥3 domains with ≥2 strengths — validation test.
5. Minimum 2 protected assets for activation — validation test.
6. Commercial confidence cannot exceed `medium` — validation test.
7. Author genre tag without L1 evidence cannot become `identity_key` — validation test.
8. Status model supports all 11 states in Section 9.
9. Active profile rejected when independent read coverage < 60% unless explicit override with audit — gate test.
10. Manuscript version change creates superseding profile — integration test.
11. Author dispute transitions to `blocked` and resolves to revised or deferred state — integration test.
12. Initial roadmap Stage 1 fails when profile flag on and no active profile — gate test.
13. Post-expert findings do not mutate active pre-expert profile — immutability test.
14. `npm run governance:capability-check` passes on this PRD.
15. All focused unit tests in Section 36 pass.

---

## 36. Testing requirements

### Unit tests (`lib/editorial-profile/` — implementation phase)

1. Contract validation — required fields present
2. Story identity — rejects author category without evidence
3. Story identity — requires ≥2 locators for primary high confidence
4. Story engines — at least one engine, at most one primary
5. Editorial characteristics — minimum 5 entries, 3 domains, 2 strengths
6. Technical characteristics — specialist_need critical requires materiality critical + confidence medium+
7. Emotional characteristics — minimum 3 entries, 1 effective
8. Protected assets — minimum 2 for activation
9. Editorial risks — blocking requires evidence; max 10
10. Specialist requirements — no expert keys; none entries for evaluated domains
11. Commercial — confidence cap medium; scope always pre_expert_preliminary
12. Roadmap inputs — hints marked preliminary when source confidence low
13. Evidence hierarchy — rejects brief/understanding/intent as evidence source
14. Status transitions — valid paths only
15. Prohibited input detection — aborts to failed
16. Immutability — active profile entries cannot mutate
17. Supersession chain — supersedes_profile_id linkage
18. Author intent modifier — cannot invent domain need
19. Aggregate confidence caps — coverage and low-section rules
20. Feature flag off — no synthesis invoked

### Integration tests

21. Full synthesis from fixture independent read output
22. Roadmap Stage 1 gate requires active profile
23. Author dispute flow end-to-end
24. Version change supersession
25. PEU alignment patch without reclassification

### Governance

26. `npm run governance:capability-check -- docs/governance/implementation/STORYDNA_EDITORIAL_PROFILE_PRD.md`

---

## 37. Deferred decisions

| Decision | Rationale | Target phase |
|----------|-----------|--------------|
| Post-expert profile enrichment (`@v2`) | Pre-expert immutability confirmed; enrichment design separate | EP-7 |
| Provider-assisted classification | Deterministic rules first per framework | EP-2+ |
| ML taxonomy for identity/engine | Explicitly out of Phase 1 scope | Future |
| Standalone `EIC_INDEPENDENT_READ_FRAMEWORK.md` | Boundaries sufficient in UX blueprint for now | Separate artifact |
| Author-facing full contract vs summary view | UX detail deferred to EP-5 | EP-5 |
| Partial independent re-read scope rules | Requires read contract maturity | EP-2 |
| Expert profile extension/challenge artifact shape | Post-expert boundary | EP-6 |

---

## 38. Open questions

1. Should `author_disputed` remain a distinct status or only the `blocked` + dispute metadata overlay? **Proposed:** overlay on `blocked` only.
2. Minimum independent read coverage threshold for activation — 60% firm or configurable per genre/format?
3. Whether profile summary is shown to author before or after roadmap draft — UX sequencing with initial roadmap presentation.
4. Exact controlled vocabulary amendment process for new identity/engine keys — minor amendment vs registry extension.
5. Series with prior canon (Flow J): how much prior-edition profile context may inform continuity flags without cross-version evidence contamination?

---

## 39. Recommended implementation sequence

| Step | Deliverable | Depends on | Phase |
|------|-------------|------------|-------|
| 1 | PRD approved (this document) | Framework EP-0 | — |
| 2 | `storydna_editorial_profile@v1` types + validation (`lib/editorial-profile/`) | PRD | EP-1 |
| 3 | Controlled vocabularies for identity, engine, emotion, domain keys | Step 2 | EP-1 |
| 4 | Profile synthesis service (deterministic rules) | Step 2, independent read contract | EP-2 |
| 5 | Persistence + migration | Step 4 | EP-3 |
| 6 | Feature flag `STUDIO_EDITORIAL_PROFILE_ENABLED` | — | EP-3 |
| 7 | Wire to initial roadmap creation Stage 1 | Step 5, IER-1 | EP-4 |
| 8 | Author dispute UI + revision flow | Step 7 | EP-5 |
| 9 | Expert context injection (read-only summary) | Step 7, ER-6 | EP-6 |
| 10 | Post-expert profile extension design | Step 7 + adjudication | EP-7 |

**Explicitly out of scope for EP-1 through EP-3:**

- Provider-generated classifications without deterministic validation
- Direct expert launch from specialist requirements
- Author self-classification UI
- Mutating pre-expert profile with expert findings

---

## Product flows (A–J)

### Flow A — First profile after Independent Read

```
Gates pass → generating → draft → awaiting_eic_confirmation
    → EIC confirms → active → feeds roadmap Stage 1
```

### Flow B — With Author Intent

Author Intent linked as `author_intent_id`. Destination alignment computed. Intent modifiers applied to specialist requirements. Identity and engines still L1-derived only.

### Flow C — Author Intent incomplete

Profile blocked at `not_started`. Independent read may complete but profile remains `awaiting_independent_read` until active intent or submitted brief exists.

### Flow D — Conflicting author/manuscript evidence

Profile classifies from manuscript. `author_framing_alignment: divergent` recorded. `alignment_note` explains gap. Roadmap destination still follows author intent; profile informs distance.

### Flow E — Update after PEU

Understanding reconfirmed → alignment fields patched → status `updated`. No craft reclassification without new read evidence.

### Flow F — Update after specialist findings

Pre-expert profile unchanged. Roadmap regenerates from expert findings. Profile remains historical snapshot.

### Flow G — Specialist recommendation + author consent

Profile Section 8 → roadmap Stage 7 maps domain to experts → author approves team → manuscript sharing gate → experts run.

### Flow H — Roadmap handoff

Active profile `roadmap_inputs` consumed by initial roadmap creation. Profile hints may be overridden with documented rationale in roadmap.

### Flow I — Incomplete/low-confidence

Synthesis → `incomplete_evidence` or active with preliminary banner. Author sees honest coverage gap copy. Re-read recommended.

### Flow J — Series with prior canon

`series_context_modifier` elevates continuity/timeline requirements. Prior edition profile may inform **flags only** with `is_current_version_evidence: false` — classifications require L1 from current version.

---

## Rollout / certification gates

- Private Studio only (`STUDIO_EDITORIAL_PROFILE_ENABLED`).
- Defaults off; production unavailable until explicit enablement.
- No expert commercially enabled.
- Requires complete independent read pipeline (Phase 1B-b+).
- EP-4 roadmap integration requires initial roadmap creation implementation.

---

## Governance

- **Registry:** `cap.editorial_profile` in [CAPABILITY_REGISTRY.json](../capabilities/CAPABILITY_REGISTRY.json)
- **Conformance:** `npm run governance:capability-check -- docs/governance/implementation/STORYDNA_EDITORIAL_PROFILE_PRD.md`
- **Framework traceability:** Every framework requirement operationalized in this PRD or explicitly deferred in Section 37
