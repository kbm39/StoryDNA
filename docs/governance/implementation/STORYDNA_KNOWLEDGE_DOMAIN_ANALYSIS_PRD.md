# Feature PRD — StoryDNA Knowledge Domain Analysis and Specialist Recommendation

## Summary

- **Feature name:** StoryDNA Knowledge Domain Analysis and Specialist Recommendation (`storydna_knowledge_domain_analysis@v1`)
- **Owner:** Kevin Track / StoryDNA Editorial Organization
- **Target phase:** KDA-1 through KDA-12 (implementation phases per Section 50)
- **Constitution baseline:** v1.0 + Amendment 001 (RATIFIED) + Amendment 002 (RATIFIED)
- **Source framework:** [STORYDNA_KNOWLEDGE_DOMAIN_ANALYSIS_FRAMEWORK.md](./STORYDNA_KNOWLEDGE_DOMAIN_ANALYSIS_FRAMEWORK.md)
- **Registered capability:** `cap.knowledge_domain_analysis`
- **Related artifacts:** [STORYDNA_EDITORIAL_PROFILE_FRAMEWORK.md](./STORYDNA_EDITORIAL_PROFILE_FRAMEWORK.md), [STORYDNA_EDITORIAL_PROFILE_PRD.md](./STORYDNA_EDITORIAL_PROFILE_PRD.md), [STORYDNA_EDITORIAL_ROADMAP_FRAMEWORK.md](./STORYDNA_EDITORIAL_ROADMAP_FRAMEWORK.md), [EIC_INITIAL_EDITORIAL_ROADMAP_CREATION_FRAMEWORK.md](./EIC_INITIAL_EDITORIAL_ROADMAP_CREATION_FRAMEWORK.md), [STORYDNA_CONVERSATIONAL_INTELLIGENCE_FRAMEWORK.md](./STORYDNA_CONVERSATIONAL_INTELLIGENCE_FRAMEWORK.md), [EIC_PHASE_1A_AUTHOR_INTENT_PRD.md](./EIC_PHASE_1A_AUTHOR_INTENT_PRD.md), [EDITORIAL_PROFILE_RUNTIME_IMPLEMENTATION.md](./EDITORIAL_PROFILE_RUNTIME_IMPLEMENTATION.md)

---

## 1. Document purpose

This PRD operationalizes the [Knowledge Domain Analysis Framework](./STORYDNA_KNOWLEDGE_DOMAIN_ANALYSIS_FRAMEWORK.md) into implementable product requirements. It defines what Knowledge Domain Analysis **is**, what it **is not**, how it is created, validated, versioned, projected into the Editorial Profile, and consumed by roadmap and author-facing experiences — **without weakening, replacing, or silently expanding** the framework or constitutional boundaries.

**Scope:** Product requirements, contracts, lifecycle, author-response model, acceptance criteria, testing requirements, and implementation sequence. **No runtime code, migrations, UI, expert registry seeds, fixture changes, or commercial enablement** are authorized by this PRD alone.

---

## 2. Product context

StoryDNA's Editorial Profile records technical characteristics and specialist requirement **levels**, but does not yet reliably perform manuscript-level **Knowledge Domain Analysis** — the EIC-owned process that identifies all materially important professional knowledge domains, maps them to registered capabilities, explains recommendations in plain English, and handles missing specialists honestly.

```
Author Intent + Manuscript Brief + Confirmed Understanding  (framing only)
        │
        ▼
EIC Independent Read  (editor_in_chief_owned)
        │
        ▼
Knowledge Domain Analysis  (editor_in_chief_owned)  ← THIS PRD
        │ projects summarized outputs
        ▼
Editorial Profile  (editor_in_chief_owned)
        │
        ├──► Initial Editorial Roadmap Creation (Stage 7+)
        ├──► EIC Editorial Plan Gate (team recommendation)
        └──► Author-facing Recommended Specialist Support
```

**Note:** `EIC_INDEPENDENT_READ_FRAMEWORK.md` does not yet exist as a standalone artifact. Independent-read boundaries are incorporated from [EIC_CONVERSATIONAL_INTAKE_AND_TEAM_APPROVAL_UX_BLUEPRINT.md](./EIC_CONVERSATIONAL_INTAKE_AND_TEAM_APPROVAL_UX_BLUEPRINT.md) §9–§10 and [STORYDNA_CONVERSATIONAL_INTELLIGENCE_FRAMEWORK.md](./STORYDNA_CONVERSATIONAL_INTELLIGENCE_FRAMEWORK.md) §9.

**Concepts that must remain distinct:**

| Concept | Owner / locus |
|---------|---------------|
| Knowledge domain | `storydna_knowledge_domain_analysis@v1` |
| Manuscript characteristic | Editorial Profile sections |
| Capability | Expert Registry |
| Expert | Expert Registry identity |
| Expert assignment | Editorial plan / roadmap post-approval |
| Specialist finding | Expert immutable artifact post-run |
| Roadmap action | Editorial Roadmap synthesis |

---

## 3. Constitutional authority

### Constitution Compliance

```json
{
  "applicable_sections": ["§0", "§1", "§6", "§8", "§10", "§12", "§13", "§14", "Amendment 001", "Amendment 002"],
  "compliance_explanation": "Knowledge Domain Analysis implements §0 by enabling the EIC to identify materially important knowledge domains before specialist recruitment. §1 Author Intent and confirmed Editorial Understanding remain framing; domain identification follows demonstrated manuscript content. §6 Expert Governance: EIC maps domains to certified capabilities; specialists produce judgments only after author consent and manuscript sharing. §8: domain analysis is orchestration metadata, not a Unified Finding. §10: EIC owns domain identification, capability mapping, sequencing, and author explanation. §12: authors retain creative authority and approve team/sharing separately from recommendation display. §13: every domain claim requires evidence, locators, confidence, materiality, and honest uncertainty. Amendment 001: propagation review completed. Amendment 002: author dialogue must deepen understanding; disagreement remains visible.",
  "amendment_required": "No",
  "backward_compatibility_impact": "Additive EIC orchestration layer upstream of Editorial Profile projections. Existing profile, roadmap, and expert workflows remain when KDA flags are off.",
  "certification_impact": "No expert commercially enabled. Recommendations reference registry certification honestly. Registry gaps do not authorize substitute experts or commercial enablement."
}
```

---

## 4. Capability-propagation analysis

### Primary capability review

```json
{
  "new_capability_introduced": "Knowledge Domain Analysis and Specialist Recommendation (storydna_knowledge_domain_analysis@v1)",
  "existing_capability_modified": "cap.editorial_profile — Technical Characteristics, Specialist Requirements, Editorial Risks, Roadmap Inputs gain authoritative upstream source; cap.eic_initial_roadmap_creation Stage 7; cap.editorial_roadmap specialist team blocks; EIC editorial plan gate",
  "classification": "editor_in_chief_owned",
  "existing_experts_evaluated": ["literary_agent", "military_expert", "developmental_editor", "editor_in_chief"],
  "future_experts_affected": ["police_procedure_expert", "organized_crime_expert", "criminal_law_expert", "firearms_expert", "medical_expert", "intelligence_expert", "forensics_expert", "financial_crimes_expert"],
  "editor_in_chief_impact": "Primary owner. EIC executes analysis after independent read; maps domains to capabilities; explains recommendations; sequences specialists; handles registry gaps.",
  "platform_impact": "New versioned contract, lifecycle, author-response model, profile projection rules, registry gap telemetry, shared evidence vocabulary.",
  "certification_impact": "No commercial enablement change.",
  "propagation_decision": "move_to_editor_in_chief",
  "review_artifact_path": "docs/governance/implementation/STORYDNA_KNOWLEDGE_DOMAIN_ANALYSIS_PRD.md"
}
```

### Capability propagation matrix

| Sub-capability | expert_specific | expert_family | editorial_board_shared | editor_in_chief_owned | platform_wide | Decision |
|----------------|-----------------|---------------|------------------------|----------------------|---------------|----------|
| Manuscript-level domain identification | — | — | — | **Primary** | — | move_to_editor_in_chief |
| Domain materiality / centrality | — | — | — | **Primary** | — | move_to_editor_in_chief |
| Domain-to-capability mapping | — | — | — | **Primary** | — | move_to_editor_in_chief |
| Specialist recommendation composition | — | — | — | **Primary** | — | move_to_editor_in_chief |
| Specialist sequencing rationale | — | — | — | **Primary** | — | move_to_editor_in_chief |
| Missing-specialist gap signaling | — | — | — | Primary author comm | **Registry telemetry** | split |
| Author response persistence | — | — | — | EIC rejoinder | **Contract owner** | move_to_platform |
| Domain evidence model | — | — | Shared consumption | Primary producer | **Vocabulary owner** | move_to_platform |
| Expert Registry resolution | — | — | — | Consumer | **Authority owner** | move_to_platform |
| Post-expert domain reconciliation | Per-expert findings | **Board reconcile** | — | — | — | defer post-expert |

---

## 5. Product goals

1. Persist a versioned `storydna_knowledge_domain_analysis@v1` artifact per manuscript edition after independent read.
2. Identify all materially important knowledge domains from manuscript evidence — not keyword or genre stereotypes.
3. Map domains to registered capabilities with honest registry-gap handling.
4. Produce evidence-backed specialist recommendations in plain English with manuscript examples.
5. Support structured author responses without treating disagreement as automatic correction.
6. Project summarized outputs into Editorial Profile without collapsing artifacts or concepts.
7. Supply roadmap and editorial-plan inputs for team sequencing and dependencies.
8. Preserve separate consent and manuscript-sharing gates.
9. Maintain append-only audit history and independent artifact versioning.
10. Meet Amendment 002: domain explanations deepen understanding; anti-echo; visible conflict.

---

## 6. Non-goals

- Runtime implementation in this PRD commit task
- UI implementation
- Database migrations or persistence schema (deferred KDA-3+)
- Expert Registry seeds or expert activation
- Commercial enablement changes
- Altering Editorial Profile dev fixture
- Replacing Editorial Profile, Roadmap, or Independent Read frameworks
- Keyword-only or genre-only domain classifiers
- Closed permanent domain taxonomy
- Automatic expert launch or manuscript sharing on recommendation display
- Roadmap generation, grading, or Next Best Action selection
- Provider synthesis without deterministic validation (deferred)

---

## 7. Responsible editorial roles

| Role | Responsibility |
|------|----------------|
| **Editor-in-Chief** | Executes domain analysis; maps capabilities; composes recommendations; confirms artifact; presents evidence on dispute |
| **Author** | Reviews recommendations; responds; approves team and sharing separately; retains creative authority |
| **Platform operator** | Feature flags, observability, registry gap telemetry, audit access |
| **Specialists (post-approval)** | Produce findings within certified domains only; do not author pre-expert domain analysis |
| **Editorial Board (post-expert)** | Reconciles overlapping specialist conclusions when needed — not pre-expert domain ID |

---

## 8. Users

| User | Need |
|------|------|
| **Author (Kevin Track / private Studio)** | Understand which professional domains materially affect their manuscript and why — without configuring experts |
| **EIC (orchestration)** | Structured artifact for team recommendation, sequencing, and honest gap reporting |
| **Platform engineering** | Validated contract, lifecycle, projection rules, tests |
| **Governance** | Capability registry, propagation conformance, certification boundary |

Initial rollout: **private Studio only** behind development flags.

---

## 9. Preconditions

Analysis may begin **only when all** are true:

| Gate | Artifact / state |
|------|------------------|
| Author Intent active | `storydna_author_intent@v1` valid for manuscript (when Phase 1A enabled) |
| Understanding confirmed | `storydna_editorial_understanding@v1` status = `confirmed` (when PEU enabled) |
| Manuscript brief submitted | `storydna_author_manuscript_brief@v1` status = `submitted` (when conversational intake enabled) OR Author Intent path satisfied |
| Independent read complete | `storydna_eic_independent_read@v1` status = `complete` |
| Manuscript version authoritative | `manuscript_version_id` matches read scope |
| Zero specialist access | `specialist_manuscript_access_count = 0` for version |
| Parent flags | `STUDIO_EIC_ENABLED=1`, `STUDIO_AUTHOR_INTENT_ENABLED=1`, `STUDIO_KNOWLEDGE_DOMAIN_ANALYSIS_ENABLED=1` |
| No conflicting active analysis | No other `active` analysis for same `(manuscript_id, manuscript_version_id)` unless supersession |

If gates fail → `not_started` or `awaiting_independent_read`.

---

## 10. Trigger and lifecycle

### Triggers

| Trigger event | Action |
|---------------|--------|
| `independent_read_complete` | Begin analysis (`generating`) |
| `manuscript_version_change` | Supersede prior analysis; new record for new version |
| `author_dispute_resolved` | Revise disputed entries; supersede disputed version |
| `peu_understanding_reconfirmed` | Update alignment modifiers only — no automatic reclassification without new read |
| `specialist_findings_complete` | Do **not** mutate pre-expert analysis |
| `profile_projection_requested` | Project to profile candidate when analysis `awaiting_eic_confirmation` or `active` |

### Status state model

Aligned with [Editorial Profile PRD](./STORYDNA_EDITORIAL_PROFILE_PRD.md) Section 9 conventions:

| Status | Meaning | Valid transitions |
|--------|---------|-------------------|
| `not_started` | No record; gates unmet | → `awaiting_independent_read`, `blocked` |
| `awaiting_independent_read` | Gates met except read | → `generating`, `blocked` |
| `generating` | Synthesis in progress | → `draft`, `incomplete_evidence`, `failed` |
| `incomplete_evidence` | Thresholds unmet | → `generating`, `draft`, `blocked` |
| `draft` | Validated structure; EIC review | → `awaiting_eic_confirmation`, `generating`, `failed` |
| `awaiting_eic_confirmation` | Pending joint EIC confirmation | → `active`, `draft`, `failed` |
| `active` | Canonical analysis for version | → `updated`, `superseded`, `blocked` |
| `updated` | Alignment/metadata patch only | → `active`, `superseded` |
| `superseded` | Replaced by newer analysis | Terminal |
| `blocked` | Dispute or policy block | → `draft`, `generating`, `superseded` |
| `failed` | Synthesis/validation error | → `generating` |

### Illegal transitions (must fail validation)

| Transition | Reason |
|------------|--------|
| `incomplete_evidence` → `active` | Minimum evidence thresholds unmet |
| `failed` → `active` | Must regenerate through `draft` / `awaiting_eic_confirmation` |
| `blocked` → `active` without resolution | Dispute unresolved |
| `superseded` → `active` | Terminal status |
| Recommendation display → specialist activation | Consent gate |
| Author response → silent evidence deletion | Audit violation |
| Registry gap → unrelated expert substitution | Prohibited behavior |

### Author dispute overlay

When author disputes domain conclusion or recommendation on `active` analysis → `blocked` with dispute metadata. Resolution → revised analysis (`draft` → `awaiting_eic_confirmation` → `active`) or logged disagreement with visible conflict.

---

## 11. Knowledge Domain Analysis artifact definition

**Contract:** `storydna_knowledge_domain_analysis@v1`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `contract_version` | string | yes | Always `storydna_knowledge_domain_analysis@v1` |
| `analysis_id` | uuid | yes | Stable artifact identity |
| `manuscript_id` | uuid | yes | Book identity |
| `manuscript_version_id` | uuid | yes | Edition scope |
| `independent_read_id` | uuid | yes | Source read |
| `editorial_profile_id` | uuid? | no | Linked profile after projection |
| `author_intent_id` | uuid? | yes when intent enabled | Framing reference |
| `editorial_understanding_id` | uuid? | yes when PEU enabled | Framing reference |
| `eic_execution_id` | uuid | yes | Orchestration run identity |
| `status` | enum | yes | Lifecycle status |
| `created_at` | timestamp | yes | Record creation |
| `updated_at` | timestamp | yes | Last mutation |
| `activated_at` | timestamp? | no | Set on `active` |
| `supersedes_analysis_id` | uuid? | no | Prior analysis linkage |
| `superseded_by_analysis_id` | uuid? | no | Forward linkage |
| `domains` | DomainEntry[] | yes | Domain conclusions |
| `recommendations` | SpecialistRecommendation[] | yes | May be empty when no material domains |
| `registry_gaps` | RegistryGapEntry[] | yes | Explicit empty array allowed |
| `capability_mappings` | CapabilityMappingEntry[] | yes | Domain → capability resolution |
| `author_responses` | AuthorResponseEntry[] | yes | Append-only |
| `eic_confirmation` | EicConfirmationRecord? | no | Required when `active` |
| `provenance` | ProvenanceBlock | yes | Source artifact IDs, coverage |
| `audit_history` | AuditEvent[] | yes | Append-only |
| `synthesis_confidence` | AnalysisConfidenceBlock | yes | Aggregate metadata |
| `is_expert_finding` | boolean | yes | Always `false` |
| `is_manuscript_evidence` | boolean | yes | Always `false` |
| `is_author_intent` | boolean | yes | Always `false` |

**Constitutional flags:** `is_expert_finding`, `is_manuscript_evidence`, and `is_author_intent` are always `false` — domain analysis is EIC orchestration metadata derived from manuscript evidence.

---

## 12. Domain data model

### DomainEntry

| Field | Type | Required when | Notes |
|-------|------|---------------|-------|
| `domain_id` | uuid | always | Stable identity |
| `domain_key` | string | always | Normalized internal key (e.g. `police_procedure`) |
| `author_facing_name` | string | always | Plain English (e.g. "Police procedure") |
| `description` | string | always | What this domain means for this manuscript |
| `centrality` | enum | always | See Section 16 |
| `materiality` | enum | always | `critical`, `high`, `moderate`, `low`, `negligible`, `not_material` |
| `narrative_role` | string? | optional | How domain functions in story |
| `manuscript_locations` | LocatorRef[] | centrality ≥ limited scene-specific | Chapter/scene/page refs |
| `evidence` | EvidenceEntry[] | materiality ≥ moderate | Shared profile evidence model |
| `confidence` | enum | always | `high`, `medium`, `low`, `unknown` |
| `uncertainty_notes` | string[] | when confidence < high | Author-visible |
| `conflicting_evidence` | ConflictRecord[] | when conflicts exist | Both signals visible |
| `consequence_if_inaccurate` | string? | material domains | Reader/plot impact |
| `reader_trust_impact` | enum? | optional | `severe`, `moderate`, `minor`, `unknown` |
| `plot_causality_impact` | enum? | optional | `drives_turning_points`, `supports`, `minimal`, `unknown` |
| `character_credibility_impact` | enum? | optional | `severe`, `moderate`, `minor`, `unknown` |
| `commercial_relevance` | string? | optional | Pre-expert preliminary only |
| `sensitivity_relevance` | string? | optional | When material |
| `author_authenticity_priority` | enum? | optional | From understanding: `elevates`, `neutral`, `unknown` |
| `capability_requirements` | string[] | material domains | Capability IDs or keys |
| `candidate_specialist_support` | CandidateSupport[] | when recommending | Capability + availability |
| `sequencing` | SequencingClass | when recommending | See Section 25 |
| `specialist_availability` | enum | always | `available`, `experimental`, `unavailable`, `registry_gap`, `unknown` |
| `registry_gap_status` | boolean | always | `true` when no suitable capability |
| `recommendation_status` | enum | always | `proposed`, `deferred`, `author_declined`, `approved_for_team`, `not_recommended` |
| `author_response_status` | enum | always | `none`, `pending`, `responded` |
| `roadmap_relevance` | enum? | optional | `required_input`, `optional_input`, `not_applicable` |

**Rule:** Unknown remains `unknown`. Optional fields omitted when unsupported — not invented.

---

## 13. Evidence hierarchy

Reuse Editorial Profile seven-level hierarchy ([EDITORIAL_PROFILE_RUNTIME_IMPLEMENTATION.md](./EDITORIAL_PROFILE_RUNTIME_IMPLEMENTATION.md)):

| Level | Evidence type | Pre-expert use |
|-------|---------------|----------------|
| 1 | Authoritative manuscript quotation | Primary when policy allows |
| 2 | Compliant paraphrased event | Primary when quotation disallowed |
| 3 | Scene/chapter/page locator | Minimum for moderate+ materiality |
| 4 | Multi-scene pattern | Central domain support |
| 5 | Independent-read observation | Must link to locators for on-page claims |
| 6 | Author framing | Priority modifier only — never sole proof |
| 7 | Absence statement | Explicit insufficient coverage |

**Provenance type labels (author-facing):** evidence reference, manuscript quotation, EIC interpretation, specialist conclusion (post-approval only), author-stated intent.

---

## 14. Domain detection rules

### FR-detection principles

Domain detection is **evidence-grounded**. The system must evaluate manuscript activity patterns, not vocabulary frequency alone.

**Police Procedure — detect when materially important activity includes:**

Investigations; interviews; interrogations; warrants; arrests; evidence handling; chain of custody; jurisdiction; command structure; detective decision-making; internal affairs; tactical entries; informants; law-enforcement procedure.

**Not detected from:** the word "police" alone; genre label "crime thriller"; single offhand mention.

**Organized Crime — detect when material includes:**

Hierarchy; crews or families; criminal enterprises; internal discipline; loyalty; retaliation; leadership succession; informant culture; racketeering; money movement; relations with law enforcement; organized criminal decision-making.

**Criminal Law / Prosecutorial Practice — distinct domain; detect when material includes:**

Charging; warrants; evidentiary questions; admissibility; cooperation agreements; grand jury; plea negotiations; witness preparation; prosecution strategy.

**Prohibited substitutions:**

| Invalid | Correct |
|---------|---------|
| Military Expert for Police Procedure | Police Procedures capability when police materiality met |
| Legal Expert for Organized Crime | Organized Crime capability for criminal organization authenticity |
| Any expert because registry has only that expert | Registry gap honesty |

### Negative detection requirement

For each major candidate domain in survey list (Appendix A of framework), analysis must record either a material domain entry **or** explicit exclusion with rationale (`incidental`, `not_material`, `insufficient_evidence`).

---

## 15. Materiality rules

A domain drives specialist recommendation when:

1. Centrality ∈ {`central`, `substantial_supporting`, `limited_scene_specific`} **AND**
2. Materiality ∈ {`critical`, `high`, `moderate`}

| Materiality | Testable rule |
|-------------|---------------|
| **critical** | Domain inaccuracy breaks plot turn or core reader trust for target audience |
| **high** | Informed readers would likely notice error |
| **moderate** | Localized but visible authenticity risk |
| **low / negligible / not_material** | No standalone specialist recommendation |

**Measurable inputs:** count of plot-dependent scenes; turning-point linkage; reader-trust impact enum; consequence description with locators.

---

## 16. Centrality classification

| Class | Testable decision rules |
|-------|-------------------------|
| **central** | Domain drives investigation/plot spine OR ≥2 major turning points OR sustained multi-act presence with plot dependency |
| **substantial_supporting** | Recurring scenes affecting credibility but not dominant spine |
| **limited_scene_specific** | 1–2 scenes where accuracy matters locally |
| **incidental** | Passing reference; no plot dependency |
| **speculative** | Weak inference — label only; no recommendation |
| **insufficient_evidence** | Read coverage does not support assessment |
| **not_material** | Evaluated and excluded — materiality below threshold |

**Decision inputs (minimum):** frequency of domain-dependent scenes; narrative centrality score (EIC synthesis); turning-point linkage count; reader-trust impact; plot-causality impact; realism expectations from understanding; audience sensitivity; author authenticity priority modifier.

**Forbidden:** keyword frequency alone; genre stereotypes alone.

---

## 17. Confidence

| Level | Criteria |
|-------|----------|
| **high** | ≥2 independent locator clusters OR multi-scene pattern; contrary evidence searched |
| **medium** | Clear signals; limited coverage or minor ambiguity |
| **low** | Weak/sparse — no specialist recommendation |
| **unknown** | Insufficient basis — must not recommend |

Aggregate `synthesis_confidence` computed from domain entries — pre-expert presentation cap: never certainty language.

---

## 18. Uncertainty

Each domain and recommendation must support `uncertainty_notes[]` when:

- Read coverage incomplete for section of manuscript
- Domain boundary ambiguous (e.g. police vs. prosecutorial scene)
- Capability mapping ambiguous
- Author framing diverges from manuscript spine

Uncertainty must be author-visible in plain English. Uncertainty does **not** authorize silent omission of material domains or silent registry-gap hiding.

---

## 19. Conflicting evidence

When manuscript evidence conflicts with author framing or internal locators conflict:

1. Record `ConflictRecord` with both signals and locators
2. Do not silently reconcile
3. Lower confidence unless one signal dominates on-page materiality
4. Author response may add context — does not erase manuscript signal
5. Author intent remains visible alongside manuscript evidence

---

## 20. Manuscript coverage requirements

| Requirement | Threshold |
|-------------|-----------|
| Independent read status | `complete` |
| Coverage completeness recorded | `provenance.read_coverage_percent` 0–100 |
| Central domain claims | Require locators in covered manuscript regions |
| `incomplete_evidence` status | When coverage < implementation threshold (default **70%** — tunable in KDA-3) OR any act flagged unread |
| Unevaluated regions | Listed in `provenance.uncovered_regions[]` |

Central domain claims in uncovered regions → confidence `low` or `insufficient_evidence` — not `high`.

---

## 21. Domain-to-capability mapping

| Rule | Requirement |
|------|-------------|
| Registry authority | [EXPERT-REGISTRY.md](../../EXPERT-REGISTRY.md) competencies and limitations |
| Mapping unit | `capability_id` or registered capability key — not expert display name |
| One domain → one capability | Preferred when precise |
| One domain → several capabilities | When sub-scopes differ (Firearms vs. Police Procedure) |
| One domain → registry gap | When no certified capability covers scope |
| Expert name → capability | **Forbidden** without competency verification |

`CapabilityMappingEntry` fields: `mapping_id`, `domain_id`, `capability_id`, `coverage_assessment`, `mapping_confidence`, `registry_gap`, `limitations_triggered[]`.

---

## 22. Capability-to-expert resolution

Resolution occurs at **recommendation composition** — not assignment.

| Field | Source |
|-------|--------|
| `candidate_capability_id` | Mapping output |
| `candidate_expert_keys[]` | Registry lookup — zero or more |
| `candidate_expert_family` | Optional grouping |
| `certification_status` | Registry lifecycle |
| `commercial_enablement_status` | Separate gate — unchanged by KDA |
| `availability` | `available`, `experimental`, `unavailable`, `registry_gap` |

**Rule:** Zero experts resolved with valid domain need → `registry_gap` — not substitution.

---

## 23. Missing-specialist behavior

When material domain detected and no suitable capability/expert:

| Requirement | Behavior |
|-------------|----------|
| Domain visibility | Remains in `domains[]` |
| Recommendation visibility | Remains with `specialist_availability: registry_gap` |
| Registry gap record | Append to `registry_gaps[]` |
| EIC staffing need | `recommendation_status: proposed` with gap flag |
| Roadmap dependency | Optional `blocked_pending_capability` hint |
| Platform telemetry | Registry gap event — not author action |
| Substitution | **Forbidden** |
| Fake expert | **Forbidden** |
| Implied capability from name | **Forbidden** |

**Author-facing wording (required pattern):**

> "This manuscript materially depends on organized-crime authenticity. StoryDNA has identified that need, but an appropriate specialist is not yet available in the current editorial team."

Do not ask the author to solve the registry gap.

---

## 24. Specialist recommendation rules

### SpecialistRecommendation contract

| Field | Required |
|-------|----------|
| `recommendation_id` | yes |
| `domain_id` | yes |
| `demonstrated_need` | yes — plain English |
| `manuscript_evidence` | yes — EvidenceEntry[] |
| `centrality` | yes |
| `materiality` | yes |
| `capability_rationale` | yes — why capability matters |
| `candidate_capability_id` | yes |
| `candidate_expert_keys` | yes — may be empty when gap |
| `candidate_expert_family` | optional |
| `capability_coverage` | yes |
| `certification_status` | yes |
| `availability` | yes |
| `commercial_enablement_status` | yes — must reflect actual gate |
| `manuscript_access_status` | yes — always `not_shared` pre-consent |
| `confidence` | yes |
| `uncertainty_notes` | when applicable |
| `related_protected_asset_ids` | optional |
| `related_risk_ids` | optional |
| `related_opportunity_ids` | optional |
| `sequence` | yes — SequencingClass |
| `author_facing_explanation` | yes — primary UX text |
| `author_response_status` | yes |
| `consent_status` | yes — always `not_requested` until team approval flow |
| `activation_status` | yes — always `not_activated` pre-consent |

**Inequalities preserved:**

- recommendation ≠ assignment  
- assignment ≠ manuscript access  
- manuscript access ≠ acceptance of findings  

---

## 25. Specialist sequencing

### SequencingClass enum

`immediate`, `early`, `after_structural_work`, `before_line_editing`, `before_final_polish`, `conditional`, `after_revision`, `repeat_review`, `unresolved`, `not_currently_recommended`

### Sequencing rules

| Domain type | Default sequence | Rationale |
|-------------|------------------|-----------|
| Organized Crime (central) | `early` | Plot causality and antagonist logic |
| Police Procedure (central) | `after_structural_work` or `before_line_editing` | Investigation spine stable first |
| Criminal Law / Prosecutorial | `early` to `before_final_polish` | Payoff credibility before polish |
| Military (when material) | `after_structural_work` | Only when sustained military materiality |
| Copy editing | `before_final_polish` | Later — not KDA primary output |
| Incidental domain | `not_currently_recommended` | — |

EIC must include plain-English sequencing explanation in `author_facing_explanation` or linked `sequencing_rationale` field.

---

## 26. Multi-domain cases

| Case | Requirement |
|------|-------------|
| Multiple central domains | Separate DomainEntry + SpecialistRecommendation per domain |
| Same scene, multiple domains | Each domain cites scene with distinct scope statement |
| Police + Organized Crime + Criminal Law | Three domains, three recommendations — not one "crime expert" |
| Duplicate capability risk | Recommend narrowest certified capability; document dedup rationale |

---

## 27. Overlapping capability cases

When two capabilities appear applicable:

1. Prefer capability whose `should_evaluate` explicitly covers scene scope
2. If overlap remains, recommend both with distinct scopes and sequencing
3. Record `capability_coverage` overlap in audit
4. Editorial Board reconciliation deferred until post-expert — not pre-expert collapse

---

## 28. Author-facing explanation requirements

**Prohibited primary UX:** raw `domain_key`, numeric confidence decimals, internal enums alone.

**Required author-facing structure per recommendation:**

1. Domain in plain English  
2. Why it matters to this manuscript  
3. Where it appears (locators)  
4. What specialist would evaluate  
5. Strengths to protect (when Protected Assets linked)  
6. When in editorial sequence  
7. Confidence in plain language  
8. Uncertainty (when present)  
9. Current availability / registry gap  
10. Explicit: specialist **not activated**; manuscript **not shared**  

**Template (illustrative):**

> "Police work is not background in this manuscript. It drives the investigation and several major turning points. Because the reader must believe how the detectives gather evidence, question witnesses, and make tactical decisions, I recommend a Police Procedures specialist review those scenes — if you approve adding that capability to your editorial team and sharing the manuscript. No specialist has been activated yet."

Amendment 002: explanations must deepen understanding — not echo author genre tags.

---

## 29. Manuscript-example requirements

When authoritative evidence exists, every author-facing domain conclusion and recommendation must include concrete examples.

**Supported forms:** chapter; scene; page; paragraph/location; compliant excerpt; paraphrased event; character decision; procedural choice; scene pattern; multi-scene pattern; contradiction; chronology; cause-effect sequence.

**Six author questions (must be answerable):**

1. What did the EIC observe?  
2. Where?  
3. Why does it matter?  
4. What could happen if unresolved?  
5. What would the specialist evaluate?  
6. What remains uncertain?  

**Validation rejects:** placeholder strings matching `/observation for chapter/i`, `/see relevant scenes/i`, `/TBD/i` when locators exist in provenance.

**When coverage insufficient:** explicit absence statement — no fabrication.

---

## 30. Author-response and dialogue requirements

### Response targets

Each meaningful: domain conclusion; criticism; risk; Protected Asset connection; specialist recommendation; registry gap; sequencing recommendation.

### Response types

| Type | Code |
|------|------|
| Ask for explanation | `ask_explain` |
| Ask for more evidence | `ask_evidence` |
| Agree | `agree` |
| Disagree | `disagree` |
| Explain author intention | `explain_intention` |
| Mark as intentional | `mark_intentional` |
| Provide missing context | `provide_context` |
| Ask how to strengthen | `ask_strengthen` |
| Request suggested approaches | `ask_approaches` |
| Request rewrite example | `ask_rewrite_example` |
| Ask for another specialist | `ask_other_specialist` |
| Approve roadmap input | `approve_roadmap_input` |
| Defer | `defer` |
| Reject | `reject` |
| Reopen | `reopen` |

### AuthorResponseEntry

| Field | Type |
|-------|------|
| `response_id` | uuid |
| `target_type` | enum |
| `target_id` | uuid |
| `response_type` | enum |
| `author_message` | string? |
| `created_at` | timestamp |
| `eic_rejoinder_id` | uuid? |

### State change matrix

| Response type | Confidence | Uncertainty | Conflict visible | PEU update | New version | Recommendation status | Roadmap inputs | Audit |
|---------------|------------|-------------|------------------|------------|-------------|----------------------|----------------|-------|
| `ask_explain` | unchanged | may narrow | unchanged | deepens if new synthesis | no | unchanged | unchanged | yes |
| `ask_evidence` | unchanged | may narrow | unchanged | deepens | no | unchanged | unchanged | yes |
| `agree` | may increase | may decrease | unchanged | deepens | no | may → `approved_for_team` | may add hint | yes |
| `disagree` | unchanged | unchanged | **yes** | deepens | optional if material | unchanged or `deferred` | unchanged | yes |
| `explain_intention` | unchanged | unchanged | **yes** if vs manuscript | deepens | alignment patch only | may adjust priority | may adjust | yes |
| `mark_intentional` | unchanged | unchanged | **yes** if vs evidence | deepens | no | may → `deferred` | may defer | yes |
| `provide_context` | may increase | may decrease | may resolve partial | deepens | yes if new evidence | may revise | may revise | yes |
| `defer` | unchanged | unchanged | unchanged | no | no | → `deferred` | defer hint | yes |
| `reject` | unchanged | unchanged | **yes** | records choice | no | → `author_declined` | remove hint | yes |
| `reopen` | unchanged | unchanged | unchanged | deepens | no | → `proposed` | may restore | yes |

**Rules:**

- Author disagreement does **not** automatically erase EIC conclusion or manuscript evidence  
- EIC must not treat author authority as proof manuscript achieves intended effect  
- Author intent and manuscript evidence both remain visible  

---

## 31. Author Intent relationship

| Input | Role |
|-------|------|
| Author Intent | Destination and authenticity priority modifier |
| Intent `elevates` realism | May elevate sequencing priority — cannot invent domains without evidence |
| Intent `suppresses` | May defer non-critical recommendations — cannot suppress **critical** materiality when plot still turns on domain |
| Intent divergence | Recorded in `conflicting_evidence` or alignment notes |

---

## 32. Progressive Editorial Understanding relationship

| PEU requirement | KDA application |
|-----------------|-----------------|
| Deepening | EIC domain explanations must synthesize manuscript + understanding — not echo |
| Anti-echo | Domain labels from author brief alone rejected without locators |
| Advancement quality gate | Author-facing recommendation text subject to PEU quality when provider-assisted |
| Confirmation | Understanding remains framing; domain analysis remains manuscript-evidence primary |

Author responses that supply context trigger PEU update flows per [PROGRESSIVE_EDITORIAL_UNDERSTANDING_IMPLEMENTATION_SPEC.md](./PROGRESSIVE_EDITORIAL_UNDERSTANDING_IMPLEMENTATION_SPEC.md).

---

## 33. Editorial Profile integration

### Architecture (framework Option C — preserved)

Knowledge Domain Analysis is a **separate artifact**. Editorial Profile references it via `provenance.knowledge_domain_analysis_id`.

### Projection targets

| Profile section | Projection content |
|-----------------|-------------------|
| **Technical Characteristics (§4.4)** | `domain_key`, observation, materiality, confidence, evidence, `specialist_need` |
| **Specialist Requirements (§4.8)** | `domain_key`, `requirement_level`, justification, driving_characteristic links |
| **Editorial Risks (§4.7)** | Registry gaps; credibility risks from domain analysis |
| **Roadmap Inputs (§4.10)** | `specialist_requirements_summary`, `sequencing_hints` |

### Projection rules

1. Preserve `knowledge_domain_analysis_id` in profile provenance  
2. Preserve evidence references — no orphan summaries  
3. Preserve confidence and uncertainty flags on projected entries  
4. Preserve conflict visibility  
5. Do **not** duplicate full domain artifact into profile  
6. Do **not** treat Technical Characteristics as the domain artifact  
7. Do **not** treat projected recommendations as assignments  
8. Do **not** rewrite historical provenance on refresh  

### Refresh and versioning

| Event | Behavior |
|-------|----------|
| New KDA version | Re-project to profile **candidate** before joint confirmation |
| Active profile + disputed KDA | Profile → `blocked`; KDA revision → re-project → joint re-confirmation |
| KDA `updated` alignment-only | Profile alignment fields only — no classification regen |
| Active KDA + new manuscript version | Both superseded; full re-synthesis |

Profile candidate synthesis (`createEditorialProfileCandidateFromIndependentRead`) must require linked KDA at `awaiting_eic_confirmation` when KDA flag enabled.

---

## 34. Expert Registry integration

Uses [EXPERT-REGISTRY.md](../../EXPERT-REGISTRY.md) and `lib/expert-registry/`:

| Registry concept | KDA use |
|------------------|---------|
| `knowledge_domains` | Domain matching — not sole proof |
| `competencies` / `limitations` | Mapping validation |
| `must_not_evaluate` | Blocks false mapping |
| Lifecycle / certification | Author-facing availability label |
| Commercial enablement | Unchanged — reported separately |

Military Expert seed exists; Police Procedure and Organized Crime capabilities may not — gaps must surface honestly.

---

## 35. Editorial Roadmap integration

| Roadmap touchpoint | KDA feed |
|--------------------|----------|
| Initial creation Stage 7 | Recommendations + gaps + capability IDs |
| Stage 8 sequence | SequencingClass + plain-English rationale |
| Stage 4 risks/opportunities | Domain credibility risks |
| Specialist team block | Post author team approval only |
| Milestones | `blocked_pending_capability` for registry gaps |

KDA does **not** generate roadmap, grade, or NBA.

---

## 36. Editor-in-Chief confirmation

### Options evaluated

| Option | Pros | Cons |
|--------|------|------|
| **A. Separate KDA confirmation gate** | Artifact isolation; independent author moment | Two approval beats; author fatigue; profile may activate without domain completeness |
| **B. Shared atomic confirmation with dual records** | One professional moment; profile + KDA synchronized; audit separation | Requires orchestration coordination |

### **Decision: Option B — shared atomic EIC confirmation with dual audit records**

**Implementation contract (future KDA-10):**

1. KDA must reach `awaiting_eic_confirmation` with validation pass  
2. Profile candidate synthesis includes projections from that KDA id  
3. Profile reaches `awaiting_eic_confirmation`  
4. Single orchestration entry `confirmEicPreExpertArtifacts({ analysis, profile, eicConfirmation })` atomically transitions **both** to `active`  
5. Separate `EicConfirmationRecord` stored on each artifact (`analysis.eic_confirmation`, `profile.eic_confirmation`)  
6. Failure on either artifact blocks both from `active`  
7. Author sees one coherent confirmation moment via profile presentation including Recommended Specialist Support derived from KDA  

**Post-activation dispute:** KDA may supersede independently when domain-only revision required; profile re-projected; joint re-confirmation required before author-facing publish of revisions.

Resolves framework open question #7.

---

## 37. Author consent and manuscript-sharing gate

| Gate | Requirement |
|------|-------------|
| Recommendation display | **Not** consent |
| Author agrees domain matters | **Not** sharing approval |
| Team approval workflow | Required before expert activation — [EIC_CONVERSATIONAL_INTAKE_AND_TEAM_APPROVAL_UX_BLUEPRINT.md](./EIC_CONVERSATIONAL_INTAKE_AND_TEAM_APPROVAL_UX_BLUEPRINT.md) |
| Manuscript sharing consent | Separate explicit gate before manuscript bytes to specialists |
| EIC plan gate | Author Intent valid — [EIC_PHASE_1A_AUTHOR_INTENT_PRD.md](./EIC_PHASE_1A_AUTHOR_INTENT_PRD.md) |

All recommendations must state `consent_status: not_requested` and `activation_status: not_activated` until downstream workflows advance — validated in author-facing read model per [author-facing-validation.ts](../../../lib/editorial-profile/author-facing-validation.ts) patterns.

---

## 38. Versioning

| Event | Version behavior |
|-------|------------------|
| New manuscript version | New `analysis_id`; prior → `superseded` |
| Independent read re-run | New analysis required |
| Author dispute resolved with material change | New analysis supersedes |
| PEU reconfirmed alone | `updated` alignment fields only |
| Expert findings complete | Pre-expert analysis immutable |

`supersedes_analysis_id` / `superseded_by_analysis_id` required on supersession.

---

## 39. Provenance

### ProvenanceBlock fields

| Field | Notes |
|-------|-------|
| `independent_read_id` | Required |
| `author_intent_id` | When enabled |
| `editorial_understanding_id` | When PEU enabled |
| `manuscript_brief_id` | When intake enabled |
| `editorial_profile_id` | After projection |
| `read_coverage_percent` | 0–100 |
| `uncovered_regions` | string[] |
| `specialist_manuscript_access_count` | Must be 0 pre-expert |
| `synthesis_input_hashes` | Optional integrity |

---

## 40. Auditability

Append-only `audit_history[]` events:

`analysis_created`, `domain_added`, `domain_revised`, `domain_removed`, `recommendation_added`, `registry_gap_recorded`, `capability_mapped`, `sequencing_changed`, `presented_to_author`, `author_response_recorded`, `eic_rejoinder_recorded`, `eic_confirmed`, `projected_to_profile`, `superseded`, `blocked`, `failed`

No silent mutation of active analysis entries.

---

## 41. Security and manuscript-access boundaries

| Boundary | Rule |
|----------|------|
| Pre-expert specialist access | Forbidden — `specialist_manuscript_access_count` must be 0 |
| KDA synthesis input | Independent read observations + locators — not expert artifacts |
| Registry lookup | Read-only; no manuscript in definitions |
| Author responses | Author-owned content; append-only |
| Service role persistence | Future KDA-3 — server-only writes |

---

## 42. Observability

| Event | Purpose |
|-------|---------|
| `kda.synthesis.started` / `.completed` / `.failed` | Pipeline health |
| `kda.domain.detected` | Domain key + centrality + materiality |
| `kda.registry_gap` | Product signal for capability planning |
| `kda.recommendation.presented` | Author exposure audit |
| `kda.author_response` | Dialogue funnel |
| `kda.projection.profile` | Profile integration |
| `kda.confirmation` | EIC gate |

No manuscript text in logs — locators and IDs only.

---

## 43. Failure and incomplete-evidence states

| Status | Author-facing | Recovery |
|--------|---------------|----------|
| `incomplete_evidence` | "I need more read coverage before I can responsibly assess [domains]." | Re-run after read completes |
| `failed` | Safe generic failure — no partial recommendations | Retry synthesis |
| `blocked` | Dispute state with visible reason | EIC rejoinder flow |
| Registry gap | Gap language — not failure | Platform backlog |

Partial author-facing publish from `failed` or `incomplete_evidence` → validation failure.

---

## 44. Functional requirements

| ID | Requirement |
|----|-------------|
| **FR-01** | System rejects analysis start when independent read status ≠ `complete`. |
| **FR-02** | System rejects analysis start when `specialist_manuscript_access_count > 0`. |
| **FR-03** | System rejects analysis start when `manuscript_version_id` mismatches independent read scope. |
| **FR-04** | Domain detection uses manuscript activity evidence — not keyword frequency alone. |
| **FR-05** | Genre labels alone cannot produce `central` centrality. |
| **FR-06** | Police Procedure central classification requires procedural activity locators per Section 14. |
| **FR-07** | Organized Crime central classification requires organization-structure activity locators per Section 14. |
| **FR-08** | Criminal Law domain remains distinct from Police Procedure and Organized Crime. |
| **FR-09** | Military capability recommended only when military materiality ≥ moderate with locators. |
| **FR-10** | Military capability cannot satisfy Police Procedure or Organized Crime registry gaps. |
| **FR-11** | Materiality classification uses testable rules in Section 15. |
| **FR-12** | Centrality classification uses testable rules in Section 16. |
| **FR-13** | Confidence `low` or `unknown` domains do not produce specialist recommendations. |
| **FR-14** | Conflicting evidence produces visible `ConflictRecord` — no silent merge. |
| **FR-15** | Capability mapping validates against Expert Registry competencies and limitations. |
| **FR-16** | Registry gap produces `registry_gaps[]` entry and gap author-facing language. |
| **FR-17** | Every specialist recommendation includes all Section 24 required fields. |
| **FR-18** | Every author-facing recommendation includes plain-English explanation per Section 28. |
| **FR-19** | When locators exist, recommendations include concrete examples — placeholders rejected. |
| **FR-20** | Author responses append to `author_responses[]` without deleting prior evidence. |
| **FR-21** | Author `disagree` does not remove domain entry or evidence. |
| **FR-22** | Projections preserve `knowledge_domain_analysis_id` in profile provenance. |
| **FR-23** | Projected specialist requirements contain domain keys — not expert keys. |
| **FR-24** | Joint EIC confirmation atomically activates KDA and profile or activates neither. |
| **FR-25** | Pre-consent recommendations always show `activation_status: not_activated`. |
| **FR-26** | Pre-consent recommendations always show manuscript access `not_shared`. |
| **FR-27** | Superseded analysis cannot transition to `active`. |
| **FR-28** | Feature flags off — no KDA synthesis invoked; profile legacy path preserved. |
| **FR-29** | Audit events append on every material state change. |
| **FR-30** | Unknown field values remain `unknown` — not inferred defaults. |

---

## 45. Non-functional requirements

| ID | Requirement |
|----|-------------|
| **NFR-01** | Deterministic validation — same artifact input produces same validation outcome. |
| **NFR-02** | Contract validation completes in <100ms for typical artifact (lib-only). |
| **NFR-03** | No provider calls required for validation and lifecycle guards. |
| **NFR-04** | Author-facing text generation subject to PEU advancement quality when provider-assisted. |
| **NFR-05** | Append-only audit — no in-place mutation of historical events. |
| **NFR-06** | Private Studio only until explicit production governance review. |
| **NFR-07** | No manuscript text in observability payloads. |

---

## 46. Acceptance criteria

| # | Scenario | Expected result |
|---|----------|-----------------|
| AC-01 | Police-centered manuscript with investigation spine | Police Procedures capability recommended with locators |
| AC-02 | Mob-centered manuscript with hierarchy plot | Organized Crime domain central; recommendation or registry gap |
| AC-03 | Prosecution/charging scenes present | Criminal Law capability distinct from police/mob |
| AC-04 | Registry lacks Organized Crime expert | Gap visible; no Military substitute |
| AC-05 | Single "police" mention in passing | `incidental` — no central Police recommendation |
| AC-06 | Genre "crime thriller" only | No domain recommendations without locators |
| AC-07 | Every recommendation | Includes manuscript evidence |
| AC-08 | Locators exist but placeholder text | Validation rejects |
| AC-09 | Insufficient coverage | `unknown` / `insufficient_evidence` — explicit statement |
| AC-10 | Conflicting intent vs manuscript | Both visible |
| AC-11 | Author disagrees | EIC conclusion remains with conflict flag |
| AC-12 | Author explains intention | Intent visible; evidence not erased |
| AC-13 | Recommendation displayed | No specialist activated |
| AC-14 | Team not approved | Manuscript not shared |
| AC-15 | Recommendation record | Distinct from assignment record |
| AC-16 | Profile projection | `knowledge_domain_analysis_id` in provenance |
| AC-17 | KDA output | Does not generate roadmap document |
| AC-18 | KDA enabled | Commercial enablement unchanged |
| AC-19 | Domain dispute revision | New `analysis_id`; prior superseded |
| AC-20 | Author-facing text | Plain English — no raw keys primary |

---

## 47. Testing requirements

Future tests (lib/**/*.test.ts) — not implemented in this task:

| Area | Test focus |
|------|------------|
| Contract validation | Required fields, constitutional flags, enum guards |
| Domain classification | Centrality + materiality rules |
| Keyword false positives | "police" mention → incidental |
| Genre false positives | Genre tag without locators → no recommendation |
| Police vs military | Police central + no military material → no military rec |
| Organized crime vs legal | Distinct mappings |
| Materiality thresholds | critical/high/moderate gating |
| Evidence coverage | incomplete → `incomplete_evidence` |
| Placeholder rejection | Generic strings fail when locators present |
| Confidence gating | low confidence → no recommendation |
| Conflict visibility | ConflictRecord persisted |
| Capability mapping | Registry competencies respected |
| Registry gaps | Gap record + no substitution |
| Sequencing | Class assigned + rationale present |
| Author responses | State matrix Section 30 |
| Versioning | Supersession chains |
| Provenance | ID linkage |
| Profile projection | Summarized fields + provenance ID |
| Joint EIC confirmation | Atomic active transition |
| Consent boundaries | not_activated / not_shared |
| Safe failure | failed → no author publish |
| Commercial enablement | unchanged when flag on |
| Feature flag off | no synthesis |

Reference fixtures: Appendix B worked example; [independent-read-fixtures.ts](../../../lib/editorial-profile/fixtures/independent-read-fixtures.ts) patterns.

---

## 48. Deferred decisions

| Decision | Phase |
|----------|-------|
| Persistence schema / migration | KDA-3 |
| Provider-assisted domain synthesis | KDA-4+ with calibration |
| Controlled domain vocabulary file location | KDA-2 |
| UI layout for author response | KDA-11 |
| Registry gap ticketing automation | Platform ops |
| Expert-family pattern libraries | Per-family propagation |
| Post-expert KDA `@v2` | After EP-7 |
| Minimum read coverage threshold tuning | KDA-3 |
| Firearms/police capability split policy | Registry design task |

---

## 49. Open questions

1. Registry gap author messaging: add expected timeline language or capability-status only? *(Default PRD: capability-status only — no fabricated timelines.)*  
2. Author "intentional compression" vs critical procedural plot turns — defer to dispute flow with visible conflict.  
3. Per-domain vs per-recommendation response threading — *(Default PRD: per `target_id` of domain or recommendation.)*  
4. Literary Agent commercial cross-reference in domain commercial_relevance field — pre-expert preliminary only.  

---

## 50. Recommended implementation sequence

| Phase | Scope | Depends on |
|-------|-------|------------|
| **KDA-1** | Contract types + validator (`lib/knowledge-domain-analysis/`) | This PRD |
| **KDA-2** | Lifecycle + versioning + transition guards | KDA-1 |
| **KDA-3** | Evidence + domain model constants | KDA-1 |
| **KDA-4** | Domain detection rules engine (deterministic first) | KDA-2, KDA-3, independent read |
| **KDA-5** | Domain-to-capability mapping + registry resolution | KDA-4, expert-registry |
| **KDA-6** | Missing-specialist + registry gap handling | KDA-5 |
| **KDA-7** | Editorial Profile projection layer | KDA-6, editorial-profile |
| **KDA-8** | Author-facing read model extensions for recommendations | KDA-7, author-facing-read-model |
| **KDA-9** | Author-response contract + audit | KDA-8 |
| **KDA-10** | Joint EIC confirmation orchestration | KDA-7, confirm-and-activate |
| **KDA-11** | Studio presentation (read-only) | KDA-8, KDA-10 |
| **KDA-12** | Controlled end-to-end test + acceptance fixtures | KDA-11 |
| **KDA-13** | Calibration benchmark (provider-assisted) | Certification workstream |
| **KDA-14** | Expert creation for high-value missing domains | Separate registry/certification tasks |

Do not jump to KDA-11 before contract, lifecycle, projection, and confirmation gates exist.

---

## Feature flags and commercial boundaries

Conceptual flags — **not implemented in this task:**

| Flag | Default | Requires |
|------|---------|----------|
| `STUDIO_KNOWLEDGE_DOMAIN_ANALYSIS_ENABLED` | `0` | `STUDIO_EIC_ENABLED=1`, `STUDIO_AUTHOR_INTENT_ENABLED=1` |
| `STUDIO_KNOWLEDGE_DOMAIN_RECOMMENDATIONS_ENABLED` | `0` | Master KDA flag + analysis `active` |

Optional sub-flag `STUDIO_KNOWLEDGE_DOMAIN_RECOMMENDATIONS_ENABLED` controls author-facing recommendation section exposure independently of synthesis (for staged rollout).

**Boundaries stated:**

- Default disabled; development only initially  
- Commercial enablement remains separate per expert certification  
- Expert activation remains separate  
- Manuscript sharing separately gated  
- Registry availability ≠ commercial availability  
- Display ≠ consent  

Parent flag chain mirrors [Editorial Profile PRD](./STORYDNA_EDITORIAL_PROFILE_PRD.md) Section feature flags.

---

## Appendix A — Worked example: Police and Organized Crime manuscript

**Premise:** Literary crime novel — detective unit vs mob-linked racket; wire and arrest sequence. No sustained military operations.

### A.1 Manuscript evidence detected

| Locator | Evidence |
|---------|----------|
| Ch. 3 | Squad briefing — surveillance roles, chain of command |
| Ch. 9 | Interrogation — waiver, counsel request, termination |
| Ch. 12 | Wire affidavit drafting; prosecutorial sign-off |
| Ch. 14 | Evidence logging; chain-of-custody challenge |
| Ch. 18 | Tactical entry planning; jurisdiction coordination |
| Ch. 2 | Crew hierarchy — captain, soldiers, earners |
| Ch. 7 | Internal discipline for skimming |
| Ch. 11 | Racket payments; front business |
| Ch. 15 | Informant handling; loyalty/retaliation |
| Ch. 20 | Leadership succession affects climax |
| Ch. 16 | Charging conference; cooperation offer |
| Ch. 19 | Grand jury presentation; admissibility dispute |
| Ch. 5 | Veteran backstory mention only |

### A.2 Domain classification

| Domain | Centrality | Materiality |
|--------|------------|-------------|
| Police Procedure | central | critical |
| Organized Crime | central | critical |
| Criminal Law / Prosecutorial | substantial_supporting | high |
| Military operations | incidental | not_material |
| Firearms | limited_scene_specific | moderate |

### A.3–A.6 Confidence and uncertainty

- Police / Organized Crime: **high** confidence  
- Criminal Law: **medium** — fewer scenes but plot-linked  
- Uncertainty note: "Act III courtroom coverage incomplete — admissibility payoff may need revision after full read."

### A.7 Domain-to-capability mapping

| Domain | Capability | Availability |
|--------|------------|--------------|
| Police Procedure | `police_procedure` | unavailable → **registry gap** (or experimental if seeded) |
| Organized Crime | `organized_crime` | **registry gap** |
| Criminal Law | `criminal_law_prosecutorial` | unavailable → gap |
| Military | — | not recommended |

### A.8–A.10 Recommendations

**Police Procedures (plain English):**

> "Police work is not background in this manuscript — it drives the investigation and several major turning points. In Chapters 3, 9, 12, 14, and 18, your detectives conduct interviews, seek warrants, handle evidence, and plan a tactical entry in ways readers will judge against real procedure. I recommend a Police Procedures specialist review that material if you approve adding that capability to your team and sharing the manuscript. No specialist has been activated yet."

**Organized Crime:**

> "Your antagonist organization's hierarchy, discipline, and enterprise logic drive Act II and the climax. In Chapters 2, 7, 11, 15, and 20, readers who know crime fiction will judge whether the mob behaves coherently. StoryDNA has identified that need, but an appropriate Organized Crime specialist is not yet available in the current editorial team. I am recording that gap — I will not substitute an unrelated expert."

**Criminal Law / Prosecutorial:**

> "Charging decisions, cooperation offers, and grand jury material in Chapters 12, 16, and 19 mean legal consequences must match your investigation. A Criminal Law or Prosecutorial Practice specialist should review that thread — distinct from detective procedure — before you finalize the investigative payoff."

### A.11 Military relevance

Ch. 5 veteran mention → **not recommended**. No sustained tactical military materiality. Military Expert must not substitute for Police or Organized Crime gaps.

### A.12 Missing Organized Crime expertise

`registry_gaps[]` entry; author-facing gap language; platform telemetry `kda.registry_gap`; roadmap hint `blocked_pending_capability`.

### A.13 Sequencing

| Domain | Sequence | Rationale |
|--------|----------|-----------|
| Organized Crime | early | Plot causality |
| Police Procedure | after_structural_work | Investigation spine first |
| Criminal Law | before_final_polish | Payoff credibility |

Plain English sequencing paragraph included in EIC presentation.

### A.14–A.15 Author response

Author selects `ask_evidence` on Organized Crime gap → EIC surfaces Ch. 7, 11, 15 locators. Author `disagree` on Criminal Law priority → conflict visible; recommendation `deferred` not deleted.

### A.16 Progressive Editorial Understanding

EIC rejoinder synthesizes author intention ("procedural compression intentional") **and** cites Ch. 12 warrant plot turn — both visible; PEU understanding record updated with deepening note.

### A.17 Editorial Profile projection

- Technical Characteristics: 3 entries with evidence links  
- Specialist Requirements: `police_procedure: critical`, `organized_crime: critical`, `criminal_law: high`  
- Editorial Risks: registry gap staffing risk  
- Roadmap Inputs: sequencing hints  
- Provenance: `knowledge_domain_analysis_id` preserved  

### A.18 Editorial Roadmap feed

Stage 7: three capability recommendations + two gap flags  
Stage 8: sequencing from KDA  
No roadmap document generated by KDA.

---

## Conformance

- **Registry:** `cap.knowledge_domain_analysis` — update source documentation to include this PRD  
- **Check:** `npm run governance:capability-check -- docs/governance/implementation/STORYDNA_KNOWLEDGE_DOMAIN_ANALYSIS_PRD.md`
