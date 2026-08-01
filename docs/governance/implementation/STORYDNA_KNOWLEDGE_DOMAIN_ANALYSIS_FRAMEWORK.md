# StoryDNA Knowledge Domain Analysis and Specialist Recommendation Framework

**Document type:** Platform architecture design (no runtime implementation)  
**Owner:** Kevin Track / StoryDNA Editorial Organization  
**Branch baseline:** `feature/eic-phase-1a-author-intent`  
**Constitution baseline:** v1.0 + Amendment 001 (RATIFIED) + Amendment 002 (RATIFIED)  
**Related artifacts:** [STORYDNA_EDITORIAL_PROFILE_FRAMEWORK.md](./STORYDNA_EDITORIAL_PROFILE_FRAMEWORK.md), [STORYDNA_EDITORIAL_PROFILE_PRD.md](./STORYDNA_EDITORIAL_PROFILE_PRD.md), [STORYDNA_EDITORIAL_ROADMAP_FRAMEWORK.md](./STORYDNA_EDITORIAL_ROADMAP_FRAMEWORK.md), [EIC_INITIAL_EDITORIAL_ROADMAP_CREATION_FRAMEWORK.md](./EIC_INITIAL_EDITORIAL_ROADMAP_CREATION_FRAMEWORK.md), [STORYDNA_CONVERSATIONAL_INTELLIGENCE_FRAMEWORK.md](./STORYDNA_CONVERSATIONAL_INTELLIGENCE_FRAMEWORK.md), [EIC_PHASE_1A_AUTHOR_INTENT_PRD.md](./EIC_PHASE_1A_AUTHOR_INTENT_PRD.md), [EDITORIAL_PROFILE_RUNTIME_IMPLEMENTATION.md](./EDITORIAL_PROFILE_RUNTIME_IMPLEMENTATION.md)

**Note on source documents:** `EIC_INDEPENDENT_READ_FRAMEWORK.md` does not yet exist as a standalone artifact. Independent-read boundaries are incorporated from [EIC_CONVERSATIONAL_INTAKE_AND_TEAM_APPROVAL_UX_BLUEPRINT.md](./EIC_CONVERSATIONAL_INTAKE_AND_TEAM_APPROVAL_UX_BLUEPRINT.md) §9–§10 and [STORYDNA_CONVERSATIONAL_INTELLIGENCE_FRAMEWORK.md](./STORYDNA_CONVERSATIONAL_INTELLIGENCE_FRAMEWORK.md) §9.

---

## Constitution Compliance

```json
{
  "applicable_sections": ["§0", "§1", "§6", "§8", "§10", "§12", "§13", "§14", "Amendment 001", "Amendment 002"],
  "compliance_explanation": "Knowledge Domain Analysis implements §0 Editorial Mission by enabling the EIC to identify materially important professional knowledge domains from manuscript evidence before recruiting specialists — so authors are not expected to notice missing expertise themselves. §1 Author Intent and confirmed Editorial Understanding remain author-declared framing; domain identification follows demonstrated manuscript content, not author-selected categories alone. §6 Expert Governance is preserved: the EIC identifies domain need and recommends certified capabilities; specialists produce domain judgments only after author consent and manuscript sharing. §8 Report Governance: domain analysis is orchestration metadata feeding the Editorial Profile, roadmap, and team recommendation — not a Unified Finding or disconnected expert report. §10 EIC Governance: the EIC owns manuscript-level domain identification, capability mapping, sequencing explanation, and author-facing recommendation language. §12 Author Rights: authors retain final authority over creative choices, expert team approval, and manuscript sharing; recommendations never imply consent or activation. §13 Burden of Proof: every domain conclusion carries manuscript evidence, locators, confidence, materiality, and honest uncertainty; keyword or genre inference alone is insufficient. Amendment 001: capability propagation review completed below. Amendment 002: domain analysis and author dialogue must deepen evidence-grounded understanding — not echo author categories or collapse disagreement.",
  "amendment_required": "No",
  "backward_compatibility_impact": "Additive EIC orchestration layer. Existing Editorial Profile sections (Technical Characteristics, Specialist Requirements), roadmap creation, and expert registry remain when knowledge-domain analysis flags are off. Profile contract is extended by reference, not redefined.",
  "certification_impact": "No expert commercially enabled. Domain analysis informs recruitment recommendations only. Missing specialists are reported honestly without substituting unrelated experts or altering commercial enablement."
}
```

---

## Capability Propagation Review

```json
{
  "new_capability_introduced": "Knowledge Domain Analysis and Specialist Recommendation (storydna_knowledge_domain_analysis@v1)",
  "existing_capability_modified": "cap.editorial_profile — Technical Characteristics and Specialist Requirements gain authoritative upstream source; cap.eic_initial_roadmap_creation Stage 7; cap.editorial_roadmap specialist team blocks; EIC editorial plan gate team recommendation",
  "classification": "editor_in_chief_owned",
  "existing_experts_evaluated": ["literary_agent", "military_expert", "developmental_editor", "editor_in_chief"],
  "future_experts_affected": ["police_procedure_expert", "organized_crime_expert", "criminal_law_expert", "firearms_expert", "medical_expert", "intelligence_expert", "forensics_expert", "financial_crimes_expert", "line_editor", "character_expert", "continuity_expert", "timeline_expert"],
  "editor_in_chief_impact": "Primary owner. The EIC executes manuscript-level Knowledge Domain Analysis after independent read, before specialist manuscript access. The EIC maps domains to registered capabilities, explains recommendations in plain English, sequences specialist entry, and requests author permission before sharing.",
  "platform_impact": "New versioned contract, evidence and materiality vocabulary shared with Editorial Profile, Expert Registry gap signaling, audit trail for author responses, and author-facing recommendation requirements. Feeds cap.editorial_profile, cap.eic_initial_roadmap_creation, and cap.editorial_roadmap.",
  "certification_impact": "No commercial enablement change. Recommendations reference registered capability coverage and certification status honestly. Registry gaps do not authorize substitute experts.",
  "propagation_decision": "move_to_editor_in_chief",
  "review_artifact_path": "docs/governance/implementation/STORYDNA_KNOWLEDGE_DOMAIN_ANALYSIS_FRAMEWORK.md"
}
```

### Sub-capability classifications (reviewed)

| Sub-capability | Classification | Propagation decision | Rationale |
|----------------|----------------|---------------------|-----------|
| Manuscript-level knowledge domain identification | editor_in_chief_owned | move_to_editor_in_chief | Pre-expert EIC orchestration; not specialist judgment |
| Domain materiality and centrality assessment | editor_in_chief_owned | move_to_editor_in_chief | EIC synthesis from independent read + manuscript evidence |
| Domain-to-capability mapping | editor_in_chief_owned | move_to_editor_in_chief | EIC recruitment responsibility (§10); uses registry, does not invent experts |
| Specialist recommendation composition | editor_in_chief_owned | move_to_editor_in_chief | Plain-English explanation, sequencing, and consent framing are EIC-owned |
| Specialist sequencing rationale | editor_in_chief_owned | move_to_editor_in_chief | Constitutional EIC sequencing (§10); roadmap consumes hints |
| Missing-specialist gap signaling | editor_in_chief_owned | move_to_editor_in_chief | EIC reports staffing need honestly; platform records registry gap |
| Author response to domain conclusions | platform_wide | move_to_platform | Author-rights dialogue pattern reusable across profile, roadmap, findings |
| Domain evidence model (locators, excerpts, provenance types) | platform_wide | move_to_platform | Shared vocabulary with Editorial Profile EvidenceEntry hierarchy |
| Expert Registry capability lookup | platform_wide | move_to_platform | Registry is platform authority for capability, certification, availability |
| Expert-family domain-recognition patterns | expert_family | defer_pending_certification | Related specialists (e.g., law-enforcement family) may share evidence patterns only after per-family review |
| Editorial Board reconciliation of overlapping domains | editorial_board_shared | defer_to_post_expert | Board reconciles conflicting specialist conclusions after runs — not during pre-expert domain analysis |
| Individual specialist domain review | expert_specific | keep_expert_specific | Each specialist owns findings within certified competencies only |

### Propagation conclusions (Amendment 001 — five levels)

| Level | Conclusion |
|-------|------------|
| **Expert-specific** | Individual specialists own review **within** their certified domains after manuscript access. They do **not** own manuscript-wide domain identification. Military Expert evaluates military material; Police Procedure Expert evaluates police procedure — neither substitutes for the other's domain. |
| **Expert-family** | Related specialists may later share **evidence-pattern libraries** and recognition heuristics (e.g., law-enforcement procedural scenes) through separate expert-family propagation reviews. Families do **not** inherit ownership of manuscript-level domain analysis. |
| **Editorial Board** | The Board may reconcile overlapping or conflicting specialist conclusions **after** expert runs (e.g., prosecutorial strategy vs. detective procedure tension). The Board does **not** replace EIC pre-expert domain identification. |
| **Editor-in-Chief** | **Confirmed primary owner.** The EIC identifies materially important knowledge domains, assesses centrality and materiality, maps domains to capabilities, explains recommendations, sequences specialist entry, handles missing-specialist gaps, and presents recommendations for author approval before sharing. |
| **Platform-wide** | Platform owns provenance, capability registry integration, permissions, auditability, shared evidence standards, author-response persistence, and registry-gap telemetry. |

**Expected direction confirmed and refined:** The prompt's expected propagation direction is **correct** with one refinement — missing-specialist behavior splits between EIC-owned honest author communication and platform-owned registry-gap recording.

---

## 1. Purpose

Define how StoryDNA's Editor-in-Chief identifies the **full set of knowledge domains that materially affect a manuscript's credibility**, maps those domains to appropriate specialist capabilities, explains recommendations in professional plain English with manuscript evidence, and obtains author permission before sharing the manuscript — **without** turning StoryDNA into configuration software and **without** asking the author to assemble the expert team.

This framework is **design only**. It does not authorize runtime code, migrations, UI, expert registry entries, or commercial enablement changes.

---

## 2. Product problem

The current Editorial Profile can identify selected technical characteristics and recommend limited specialist support, but it does **not yet reliably identify the full set of knowledge domains** that materially affect credibility.

**Observed failure (development fixture review — design finding, not team criticism):** A manuscript centered on police and organized crime can surface Military expertise while failing to surface Police Procedure and Organized Crime expertise. Language is too abstract; criticism lacks explanation; examples feel generic; the experience reads like a report rather than a professional editorial discussion; the author cannot respond to individual observations.

**Root cause (design):** Technical Characteristics and Specialist Requirements record domain **signals** but lack a dedicated EIC-owned **Knowledge Domain Analysis lifecycle** with explicit detection principles, materiality thresholds, domain-to-capability mapping rules, missing-specialist behavior, plain-English author explanations, manuscript examples, and author dialogue requirements.

**Outcome this framework enables:** The author receives a professional EIC explanation of *why* each domain matters, *what evidence supports it*, *which capability should review it*, *when* it belongs in the editorial sequence, and *what remains uncertain* — including honest statements when StoryDNA has identified a need but no appropriate specialist is yet available.

---

## 3. Constitutional authority

| Authority | Application |
|-----------|-------------|
| Constitution §0 — Editorial Mission | One editorial organization identifies domain needs before recruitment |
| Constitution §1 — Author Intent | Intent informs priority and alignment; does not invent domains without evidence |
| Constitution §6 — Expert Governance | Specialists are recruited by capability; no impersonation; no activation without consent |
| Constitution §8 — Report Governance | Domain analysis is orchestration metadata, not a substitute for expert findings |
| Constitution §10 — EIC Governance | EIC owns team recommendation, sequencing, and explanation |
| Constitution §12 — Author Rights | Author approves team and manuscript sharing; retains creative authority |
| Constitution §13 — Burden of Proof | Evidence, locators, confidence, materiality required for every domain claim |
| Amendment 001 | Propagation review completed above |
| Amendment 002 | Author dialogue on domains must deepen understanding; anti-echo; visible disagreement |

**Hard boundary preserved:** Knowledge Domain Analysis does **not** redefine the Editorial Profile, Editorial Roadmap, Editor-in-Chief role, or Expert Registry. It specifies an upstream EIC-owned artifact and rules that **feed** existing contracts.

---

## 4. Relationship to the publishing-house vision

StoryDNA should feel like a world-class publishing house where the Editor-in-Chief reads the manuscript, understands what professional knowledge it depends on, and proposes the right editorial team — in plain language, with evidence — before any specialist sees the work.

The author should never think: *"I guess I need a police expert — why didn't StoryDNA mention that?"*

Instead: *"The EIC noticed my warrant scenes, interrogation sequences, and chain-of-custody plot turns depend on police authenticity — here's why that matters and what a Police Procedures specialist would review, if you approve sharing the manuscript."*

---

## 5. Capability-propagation analysis

See **Capability Propagation Review** and **Sub-capability classifications** above.

**Rejected propagation patterns:**

| Pattern | Why rejected |
|---------|--------------|
| Military Expert owns police-domain detection | Domain-specific expert must not own manuscript-wide identification |
| Keyword classifier as platform-wide auto-router | Violates §13; produces false positives and genre stereotypes |
| Author self-selects expert team without EIC guidance | Violates §10 and product vision |
| Literary Agent pre-expert domain identification | Pre-expert domain analysis is EIC-owned; LA refines commercial positioning post-run |

---

## 6. Definitions

| Term | Definition |
|------|------------|
| **Knowledge Domain** | An area of real-world, professional, cultural, historical, technical, institutional, or lived-experience knowledge that **materially affects** manuscript credibility, reader trust, narrative causality, character behavior, setting authenticity, procedural realism, commercial positioning, sensitivity, continuity, or publication risk. |
| **Domain centrality** | How structurally important a domain is to the manuscript's plot, character credibility, or reader trust — not how often a word appears. |
| **Domain materiality** | Whether inaccuracy in the domain would materially damage reader trust, plot causality, or publication risk. |
| **Capability** | A registered, certifiable evaluation scope in the Expert Registry — not an expert name. |
| **Expert** | A versioned Expert Registry identity that may implement one or more capabilities within certified boundaries. |
| **Expert family** | A related class of experts sharing orchestration patterns (e.g., law-enforcement procedural family) — not interchangeable substitutes. |
| **Specialist recommendation** | An EIC-authored, evidence-grounded proposal that a capability should review specific manuscript material — **not** activation, sharing, or assignment. |
| **Specialist assignment** | The post-approval state when an expert is engaged for a manuscript — owned by editorial plan / roadmap workflows. |
| **Registry gap** | A materially identified domain with no currently available certified capability in the Expert Registry. |
| **Manuscript evidence** | Authoritative manuscript text and locators from the current version — supreme evidence source. |
| **Framing input** | Author Intent, Manuscript Brief, confirmed Editorial Understanding — comparison and priority only. |

### Knowledge Domain centrality classes

| Class | Meaning |
|-------|---------|
| **Central domain** | Drives plot causality, major turning points, or sustained reader-trust dependency |
| **Substantial supporting domain** | Recurring scenes or decisions where inaccuracy would noticeably weaken credibility |
| **Limited scene-specific domain** | One or few scenes where domain accuracy matters locally |
| **Incidental mention** | Passing reference without plot or credibility dependency |
| **Speculative domain** | Possible domain inferred weakly — must be labeled speculative, not recommended |
| **Insufficient evidence** | Domain cannot be responsibly assessed from available read coverage |

**Rule:** Only **central**, **substantial supporting**, and **limited scene-specific** domains (when materiality threshold met) drive specialist recommendations. Incidental mentions must not.

---

## 7. Goals

1. Enable the EIC to identify **all materially important knowledge domains** from manuscript evidence after independent read.
2. Distinguish domain centrality classes and materiality honestly.
3. Map domains to **registered capabilities** — not expert names alone.
4. Produce plain-English, evidence-backed specialist recommendations the author can understand and discuss.
5. Require concrete manuscript examples when authoritative evidence exists.
6. Support author response and dialogue without treating disagreement as automatic correction.
7. Preserve author consent and manuscript-sharing gates before specialist activation.
8. Handle missing specialists honestly without substitution or silent omission.
9. Feed Editorial Profile Technical Characteristics and Specialist Requirements without collapsing distinct concepts.
10. Supply roadmap and editorial-plan inputs for team sequencing and dependencies.
11. Meet Amendment 002 quality: deepen understanding; do not echo author genre tags as domain proof.

---

## 8. Non-goals

- Runtime implementation, migrations, or UI in this framework task
- Adding experts to the Expert Registry
- Changing commercial enablement or certification tiers
- Altering the current Editorial Profile dev fixture to demonstrate this design
- Keyword-only or genre-only domain classification
- Replacing independent read, Editorial Profile, or initial roadmap creation frameworks
- Author-facing configuration of domain taxonomies
- Automatic expert activation or manuscript sharing upon recommendation display
- Closed permanent domain list — examples illustrate, they do not exhaust

---

## 9. Editor-in-Chief ownership

The EIC owns:

| Responsibility | Notes |
|----------------|-------|
| Executing Knowledge Domain Analysis | After independent read complete; before specialist access |
| Domain identification and centrality classification | From manuscript evidence + read observations |
| Materiality and confidence assessment | Per domain and per recommendation |
| Domain-to-capability mapping | Via Expert Registry lookup — honest about gaps |
| Specialist recommendation language | Plain English primary; internal keys secondary |
| Sequencing rationale | When each capability should enter editorial work |
| Missing-specialist communication | Professional author-facing gap statements |
| Presenting recommendations for author review | Distinct from consent, sharing, activation |
| Integrating author responses | Updates confidence, uncertainty, conflict visibility, profile version inputs |

The EIC does **not** own specialist findings, domain judgments inside expert reports, or Editorial Board adjudication — those remain post-approval expert artifacts.

---

## 10. Specialist ownership

| Phase | Specialist role |
|-------|-----------------|
| **Pre-expert (this framework)** | None. Specialists do not identify manuscript-wide domains or recommend themselves. |
| **Post-approval execution** | Each specialist evaluates **within certified competencies** only. |
| **Post-run contribution** | Specialists may affirm, challenge, or extend EIC domain scoping in separate immutable findings — they do not silently rewrite pre-expert domain analysis. |
| **Overlap** | When two specialists cover adjacent domains (e.g., Criminal Law and Police Procedure), each owns findings in their competency; Editorial Board reconciles conflicts if needed. |

**Prohibited:** A specialist — including Military Expert — substituting for an missing or unrun domain expert during pre-expert recommendation.

---

## 11. Knowledge Domain Analysis lifecycle

```
Independent read complete
        │
        ▼
┌───────────────────────────────────────────────┐
│  KNOWLEDGE DOMAIN ANALYSIS (EIC-owned)        │
│  - Survey manuscript + read observations      │
│  - Classify domains + centrality + materiality│
│  - Map to capabilities / registry gaps          │
│  - Compose recommendations + sequencing       │
│  - Attach evidence + examples                 │
└───────────────────────┬───────────────────────┘
                        │ feeds (summarized)
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
 Editorial Profile   EIC confirmation  Author-facing
 (technical +         gate (with        recommendation
  specialist reqs)    profile)         presentation
        │
        ▼
 Initial roadmap Stage 7 + editorial plan team block
        │
        ▼
 Author reviews recommendations (dialogue)
        │
        ▼
 Author approves team + manuscript sharing (separate gate)
        │
        ▼
 Specialist assignment + execution
```

### Lifecycle states (design)

| Status | Meaning |
|--------|---------|
| `not_started` | Independent read incomplete |
| `in_progress` | EIC analysis underway |
| `awaiting_eic_confirmation` | Analysis complete; pending EIC confirmation with profile |
| `active` | Confirmed authoritative analysis for manuscript version |
| `author_disputed` | Author challenged one or more domain conclusions |
| `superseded` | New manuscript version or resolved dispute replaced analysis |
| `incomplete_evidence` | Read coverage insufficient for responsible domain survey |
| `failed` | Synthesis error — no silent partial publish |

**Constitutional gate:** Analysis may begin only when `storydna_eic_independent_read@v1` status = `complete` and specialist manuscript access count = 0 for the version.

---

## 12. Evidence hierarchy

Reuse Editorial Profile seven-level evidence hierarchy (see [EDITORIAL_PROFILE_RUNTIME_IMPLEMENTATION.md](./EDITORIAL_PROFILE_RUNTIME_IMPLEMENTATION.md)):

| Level | Type | Use in domain analysis |
|-------|------|------------------------|
| 1 | Authoritative manuscript quotation | Primary — when excerpt policy allows |
| 2 | Compliant paraphrased manuscript event | Primary — when quotation disallowed |
| 3 | Scene / chapter / locator reference | Required minimum for moderate+ materiality |
| 4 | Pattern across multiple locators | Supports central domain claims |
| 5 | EIC independent-read observation | Valid input — must link to locators when claiming on-page content |
| 6 | Author framing (intent / brief / understanding) | Priority modifier only — never sole proof of domain |
| 7 | Absence statement | Honest "insufficient evidence in read coverage" |

**Provenance types (author-facing distinction):**

| Type | Label |
|------|-------|
| Evidence reference | "In Chapter 12, the warrant service scene…" |
| Manuscript quotation | Short compliant excerpt |
| EIC interpretation | "This sequence implies grand-jury timing pressure…" |
| Specialist conclusion | Post-approval only — not in pre-expert domain analysis |
| Author-stated intent | "You told me you want procedural realism…" |

---

## 13. Domain detection principles

The EIC must evaluate **all** of the following for each candidate domain:

| Principle | Question |
|-----------|----------|
| Narrative centrality | Does this domain drive major plot turns or sustained story spine? |
| Frequency | Do domain-dependent scenes recur across acts — not single word counts? |
| Consequence if inaccurate | Would error break reader trust or plot causality? |
| Intended audience sensitivity | Do genre/readership expectations raise the authenticity bar? |
| Realism expectations | Does the manuscript invite procedural or institutional realism? |
| Plot causality | Do outcomes depend on domain-accurate decisions? |
| Character credibility | Would professionals or insiders stop believing character choices? |
| Reader trust risk | Could factual error eject the target reader? |
| Author authenticity priority | Does confirmed understanding elevate realism expectations? |
| Manuscript evidence sufficiency | Does the read actually show domain material on the page? |
| Specialist review value | Would certified review likely improve the work materially? |

**Hard rules:**

1. **No keyword-only classification.** The word "detective" does not prove Police Procedure is central.
2. **No genre-only classification.** "Crime thriller" does not auto-require Organized Crime review.
3. **No omission because no specialist exists.** Registry gaps are reported.
4. **No substitution.** Military expertise does not stand in for Police or Organized Crime expertise.
5. **Explicit negative findings.** Major candidate domains evaluated and excluded must be logged with rationale.

---

## 14. Materiality threshold

A domain drives specialist recommendation only when **both** are true:

1. Centrality is `central`, `substantial supporting`, or `limited scene-specific` **and**
2. Materiality is `critical`, `high`, or `moderate` (per Editorial Profile materiality scale)

| Materiality | Typical domain effect |
|-------------|----------------------|
| **Critical** | Domain inaccuracy threatens plot function or core reader trust |
| **High** | Domain inaccuracy would be noticed by informed readers |
| **Moderate** | Domain review valuable; error likely localized but visible |
| **Low / negligible** | Do not recommend specialist solely on this basis |

**Military example:** A single passing mention of a character's prior service → `incidental mention`, materiality `low` → **no** Military Expert recommendation. Sustained tactical planning and live operations across multiple chapters → central domain, materiality `high` or `critical` → recommend Military capability **when materially present**.

---

## 15. Domain confidence

| Level | Meaning | Recommendation effect |
|-------|---------|----------------------|
| **High** | Multiple locators; consistent read coverage; contrary evidence searched | Full recommendation with examples |
| **Medium** | Clear signals with limited coverage or minor ambiguity | Recommend with stated uncertainty |
| **Low** | Weak or sparse signals | Do not recommend specialist; mark `speculative_domain` or `insufficient_evidence` |

**Pre-expert cap:** Domain confidence may inform recommendation strength but must **never** be presented to the author as certainty.

---

## 16. Domain uncertainty

Every recommendation must surface uncertainty explicitly when present:

| Uncertainty type | Author-facing requirement |
|------------------|---------------------------|
| Read coverage gap | "I have not yet reviewed Act III in sufficient detail to assess courtroom procedure." |
| Ambiguous domain boundary | "This scene blends detective work and prosecutorial strategy — I may recommend both capabilities after confirmation." |
| Registry mapping ambiguity | "Two capabilities may apply; I recommend the narrower certified scope first." |
| Author framing vs. manuscript divergence | "You described this as a legal thriller, but the manuscript's on-page spine is primarily investigative — my domain analysis follows the manuscript." |

Uncertainty blocks silent downgrade of recommendations or silent omission of domains.

---

## 17. Conflicting evidence

When manuscript evidence conflicts — internally, with author framing, or between locators:

1. **Do not silently reconcile.** Record conflict visibility.
2. **Present both signals** with locators where available.
3. **Lower confidence** unless one signal clearly dominates on-page materiality.
4. **Author dialogue** may clarify intent — author intent does not erase contradictory manuscript evidence.
5. **Manuscript evidence** does not erase author intent — both remain visible.

**Example:** Author states "I don't care about warrant procedure," but manuscript plot turns on an illegal search challenge → EIC records author priority modifier **and** maintains Criminal Law / Police Procedure domain recommendation with explanation of plot dependency.

---

## 18. Domain-to-capability mapping

Mapping uses the Expert Registry as authority ([EXPERT-REGISTRY.md](../../EXPERT-REGISTRY.md)):

```
Knowledge Domain  →  capability_id(s)  →  expert(s) implementing capability
                         │
                         ├─ available + certified
                         ├─ experimental / limited
                         └─ registry gap (no mapping)
```

| Mapping rule | Requirement |
|--------------|-------------|
| One domain → one capability | Preferred when registry provides precise competency |
| One domain → several capabilities | When sub-domains require distinct certifications (e.g., Firearms vs. Police Procedure) |
| One domain → specialist team | When multiple capabilities must coordinate (e.g., Organized Crime + Criminal Law) |
| One domain → no available specialist | **Registry gap** — honest author statement |
| One capability → several domains | Allowed when competency scope covers each domain subset |
| One expert name → assumed coverage | **Forbidden** — use registered competencies |

**Distinction preserved:**

| Concept | Owned by |
|---------|----------|
| Domain | EIC domain analysis |
| Capability | Expert Registry |
| Expert | Expert Registry identity |
| Assignment | Editorial plan / roadmap post-approval |
| Roadmap action | Roadmap synthesis |

---

## 19. Specialist recommendation rules

Every specialist recommendation must include:

| # | Required element |
|---|------------------|
| 1 | Domain identified (author-facing name + internal key) |
| 2 | Why the domain matters to **this** manuscript |
| 3 | Centrality class |
| 4 | Manuscript evidence supporting the conclusion |
| 5 | What could go wrong without specialist review |
| 6 | What the specialist would evaluate (scope, not verdict) |
| 7 | Strengths the specialist must protect (linked Protected Assets when known) |
| 8 | Sequencing position |
| 9 | Confidence |
| 10 | Uncertainty |
| 11 | Whether capability currently exists in registry |
| 12 | Whether specialist has been activated (**must be false** pre-consent) |
| 13 | Whether manuscript has been shared (**must be false** pre-consent) |
| 14 | What author approval is required (team + sharing — separate gates) |

**Forbidden recommendation forms:**

- "Run the Police Expert"
- "Military review recommended"
- "Technical expert needed"

without plain-English why, where, and what scope.

---

## 20. Specialist sequencing

The EIC assigns each recommendation a sequencing class:

| Class | Meaning | Example |
|-------|---------|---------|
| **Immediate** | Domain risk blocks further editorial planning | Rare pre-expert; usually conditional |
| **Early** | Domain affects plot causality before line-level polish | Organized Crime authenticity shaping mid-book turns |
| **After structural work** | Domain review best after major architecture settled | Police procedure pass after act restructuring |
| **Before final polish** | Line-level or copy stages follow domain review | Firearms detail pass before copy edit |
| **Conditional** | Depends on author choice or revision outcome | Criminal Law review if prosecution scenes expand |
| **Unresolved** | Sequencing depends on author dialogue | Pending author response on intentional procedural compression |
| **Not currently recommended** | Domain noted but review deferred with rationale | Incidental medical mention |

The EIC explains sequencing in plain English:

> "Organized-crime hierarchy drives your Act II reversal, so I would bring that specialist in early — before we polish dialogue. Police procedure can follow once the investigation spine is stable."

Roadmap Stage 8 consumes sequencing hints; profile Roadmap Inputs carry summarized hints — roadmap owns final sequence after author approval.

---

## 21. Multi-expert and overlapping-domain cases

| Case | Handling |
|------|----------|
| Adjacent domains | Separate recommendations with distinct evidence (Police Procedure vs. Criminal Law) |
| Overlapping scenes | Single scene may cite multiple domains with separate scopes |
| Redundant capabilities | EIC recommends narrowest certified capability first; avoids duplicate reviews |
| Team coordination | EIC may recommend ordered team with dependency notes — not a bundled "mega expert" |
| Conflicting specialist scopes | Editorial Board reconciliation deferred until post-run |

**Police / Organized Crime / Criminal Law:** Three domains, three capability mappings when material — not one generic "crime expert."

---

## 22. Missing-specialist behavior

When the EIC identifies a valid central or substantial domain and **no appropriate certified capability exists**:

### The EIC must not

- Ignore the domain
- Substitute an unrelated expert (e.g., Military for Organized Crime)
- Pretend the capability exists
- Reduce confidence silently to hide the gap
- Ask the author to solve the registry problem

### The EIC must

State professionally, for example:

> "This manuscript materially depends on organized-crime authenticity — hierarchy, criminal enterprise logic, and informant culture drive your plot. StoryDNA has identified that need, but an appropriate Organized Crime specialist is not yet available in the current editorial team."

### Platform recording (design)

| Signal type | Owner |
|-------------|-------|
| **Expert Registry gap** | Platform — telemetry for capability planning |
| **Editorial Roadmap dependency** | Roadmap — blocked or deferred specialist milestone with visible reason |
| **EIC unresolved staffing need** | EIC-owned status on recommendation (`capability_unavailable`) |
| **Platform development signal** | Product/governance backlog — not author action item |

**Capability propagation:** Gap signaling is **split** — EIC owns author honesty; platform owns registry and audit records.

---

## 23. Author-facing explanation requirements

Primary author experience is **plain English**. Internal classification keys (`police_procedure`, `materiality: central`, `confidence: 0.87`) are secondary metadata — never the sole explanation.

**Required structure per recommendation:**

1. **Observation** — what the EIC noticed
2. **Location** — chapter/scene/page references when available
3. **Why it matters** — credibility, causality, reader trust
4. **Specialist contribution** — what review would evaluate
5. **Uncertainty** — honest limits
6. **Next author action** — discuss, approve team, defer — not activation

**Good example:**

> "Police work is not background in this manuscript — it drives the investigation and several major turning points. In Chapters 3, 9, and 14, your detectives conduct interviews, seek warrants, and handle evidence in ways readers will judge against real procedure. Because those decisions turn the plot, I recommend a Police Procedures specialist review the investigation, interview, warrant, and evidence-handling material — if you approve adding that capability to your editorial team and sharing the manuscript."

**Bad example (forbidden as primary UI):**

```
Domain: police_procedure
Materiality: central
Confidence: 0.87
Action: run_expert
```

---

## 24. Manuscript-example requirements

Every domain conclusion, criticism, risk, or recommendation presented to the author should include **concrete supporting examples** when authoritative evidence exists.

| Example type | Use |
|--------------|-----|
| Chapter / scene / page locator | Minimum for moderate+ claims |
| Short compliant excerpt | When quotation policy allows |
| Paraphrased manuscript event | When excerpt disallowed |
| Character action / procedural choice | Links domain to on-page behavior |
| Pattern across scenes | Supports central domain claims |
| Contradiction | Shows conflicting evidence visibility |

**Forbidden when specific evidence exists:**

- "Observation for Chapter 1"
- "See relevant scenes"
- Generic placeholders

**When examples unavailable:** EIC states plainly:

> "I believe medical trauma material may become central in later acts, but my current read coverage does not yet include those chapters — I cannot cite specific scenes yet."

**Do not fabricate examples.**

---

## 25. Author response and dialogue requirements

Each meaningful EIC domain observation, criticism, risk, Protected Asset link, and specialist recommendation must later support an **author response**.

### Supported response modes (design — not UI)

| Response | Effect |
|----------|--------|
| Ask the EIC to explain further | Triggers deeper evidence presentation; Amendment 002 deepening |
| Ask to see additional evidence | EIC surfaces locators/excerpts |
| Agree | Records alignment; may accelerate roadmap inclusion |
| Disagree | Records conflict visibility — not automatic EIC reversal |
| Explain author intention | Updates framing record; does not erase manuscript evidence |
| Mark choice as intentional | Lowers recruitment priority; domain remains visible if plot-dependent |
| Supply missing context | May raise confidence or change centrality with new evidence |
| Ask what could strengthen the issue | EIC editorial direction — not rewrite |
| Ask for rewrite example | Deferred to appropriate craft specialist post-approval where applicable |
| Ask whether another specialist should review | EIC re-evaluates domain mapping |
| Approve adding to Editorial Roadmap | Roadmap input — distinct from manuscript sharing consent |
| Defer | Recommendation paused with visible status |
| Reject | Author declines recommendation; EIC logs professional disagreement if plot evidence persists |
| Reopen later | Restores deferred/disputed item |

### Effects on downstream artifacts

| Artifact | Effect |
|----------|--------|
| Progressive Editorial Understanding | Deepens when responses supply goal/context; anti-echo applies |
| Editorial Profile versioning | Dispute triggers `author_disputed` → revised profile/analysis |
| Confidence / uncertainty | Updated per response; never hidden |
| Conflict visibility | Preserved when author disagrees but evidence persists |
| Specialist recommendation status | `proposed`, `deferred`, `author_declined`, `approved_for_team`, etc. |
| Editorial Roadmap inputs | Milestones added/deferred with author choice visible |
| Audit history | Append-only response log |

**Rule:** Disagreement is not automatic correction. Author retains final authority; professional disagreement and manuscript evidence remain visible.

---

## 26. Author consent and manuscript-sharing gate

| Gate | Distinct from |
|------|---------------|
| Displaying specialist recommendation | **Not** consent |
| Author agreeing domain matters | **Not** manuscript sharing |
| Author approving editorial team | Required before activation — separate from profile acceptance |
| Manuscript sharing consent | Required before any specialist receives manuscript bytes |

Preserved from [EDITORIAL_PROFILE_RUNTIME_IMPLEMENTATION.md](./EDITORIAL_PROFILE_RUNTIME_IMPLEMENTATION.md) and [EIC_PHASE_1A_AUTHOR_INTENT_PRD.md](./EIC_PHASE_1A_AUTHOR_INTENT_PRD.md):

- Activation ≠ consent
- Recommendation display ≠ sharing approval
- EIC plan gate blocks expert launch without valid intent **and** author team approval workflow

Knowledge Domain Analysis recommendations feed the team approval conversation — they do not bypass it.

---

## 27. Editorial Profile integration

### Options evaluated

| Option | Summary | Assessment |
|--------|---------|------------|
| **A. New top-level Editorial Profile section** | Add Section 11 "Knowledge Domains" | Adds visibility but mixes orchestration analysis with profile summary; risks duplicating Technical Characteristics |
| **B. Expand Technical Characteristics only** | Fold domain lifecycle into Section 4.4 | Collapses domain analysis with characteristic observations; insufficient for recommendations, dialogue, registry gaps |
| **C. Separate EIC-owned artifact referenced by Profile** | `storydna_knowledge_domain_analysis@v1` feeds profile sections | **Recommended** |
| **D. Roadmap-only artifact** | Domain analysis lives only in roadmap | Too late — profile and EIC confirmation gate need upstream domain completeness |

### Recommended approach: **Option C**

Introduce a separate EIC-owned contract **`storydna_knowledge_domain_analysis@v1`** that:

1. Is synthesized immediately after independent read alongside profile candidate creation
2. Is referenced in Editorial Profile `provenance.knowledge_domain_analysis_id`
3. **Projects summarized outputs into** existing profile sections without redefining them:
   - **Technical Characteristics (§4.4)** — per-domain observations, materiality, specialist need signals
   - **Specialist Requirements (§4.8)** — domain keys and requirement levels with driving characteristic links
   - **Editorial Risks (§4.7)** — when domain gap or credibility risk identified
   - **Roadmap Inputs (§4.10)** — sequencing hints and specialist requirement summaries
4. Powers **author-facing Recommended Specialist Support** in the read model with plain-English recommendations derived from analysis records — not raw profile keys

**Why not collapse concepts:**

| Concept | Location |
|---------|----------|
| Manuscript characteristics | Editorial Profile editorial/technical/emotional sections |
| Knowledge domains | Knowledge Domain Analysis artifact |
| Specialist requirements | Profile §4.8 — **levels**, not expert names |
| Capability mapping | Knowledge Domain Analysis → registry lookup |
| Specialist assignments | Editorial plan / roadmap post-approval |
| Roadmap actions | Roadmap synthesis |

---

## 28. Editorial Roadmap integration

| Roadmap touchpoint | Domain analysis feed |
|--------------------|----------------------|
| Initial creation Stage 7 — Recommend experts | Domain-to-capability mappings + requirement levels + gap flags |
| Stage 8 — Editorial sequence | Sequencing classes with plain-English rationale |
| Stage 4 — Opportunities / risks | Domain credibility risks |
| Specialist team block | Approved capabilities — post author consent |
| Milestone dependencies | Registry gaps → `blocked_pending_capability` milestones |

Roadmap owns **strategy, grade, NBA, and author approval**. Domain analysis owns **domain identification and recommendation inputs**.

---

## 29. Expert Registry integration

| Registry field | Domain analysis use |
|----------------|----------------------|
| `knowledge_domains` (expert definition) | Match candidate domain to declared expert understanding |
| `competencies` / `limitations` | Verify capability covers domain scope |
| `must_not_evaluate` | Prevent false mapping |
| `domain_confidence` (declarative) | Inform honesty about experimental coverage — not live calculation in design phase |
| Lifecycle / certification status | Author-facing availability label |
| Commercial enablement | Unchanged — recommendations do not enable experts |

**One domain → many experts:** Possible in registry; EIC recommends **capability**, platform resolves expert version at activation.

**One expert → many domains:** Only where competencies explicitly cover each subset.

---

## 30. Series and prior-canon considerations

| Context | Domain analysis adjustment |
|---------|----------------------------|
| Standalone | Standard materiality rules |
| Series book | Elevate `series_continuity`, `timeline_chronology`, institutional continuity domains when demonstrated |
| Prior canon conflict | Flag as editorial risk + domain review need — Continuity / Archivist capabilities |
| Author intent "soft reboot" | Intent modifier may adjust sequencing — cannot erase demonstrated canon signals on page |

Published + series context may elevate requirement levels per Editorial Profile Framework §4.8 rule 4.

---

## 31. Versioning and provenance

| Event | Version behavior |
|-------|------------------|
| New manuscript version | New analysis supersedes prior |
| Independent read re-run | New analysis required |
| Author dispute resolved | Revised analysis supersedes disputed |
| Understanding reconfirmed alone | Alignment notes only — no automatic domain reclassification |
| Expert findings complete | Do **not** mutate pre-expert analysis — inform roadmap regeneration |

**Provenance links:** `independent_read_id`, `editorial_understanding_id`, `author_intent_id`, `manuscript_version_id`, `profile_id` (when linked).

Append-only history preserved.

---

## 32. Auditability

Audit log must capture:

- Domain entries added/removed/superseded
- Evidence locators attached
- Capability mappings and registry gap flags
- Recommendation presentation timestamps
- Author responses and EIC rejoinders
- Confidence/uncertainty changes
- Sequencing changes
- Consent and sharing gate states (separate events)

No silent edits to active analysis.

---

## 33. Failure and incomplete-evidence behavior

| Condition | Behavior |
|-----------|----------|
| Incomplete independent read coverage | Status `incomplete_evidence`; list unevaluated major domain candidates |
| Speculative domain only | No specialist recommendation; visible speculative flag |
| Registry lookup failure | Treat as gap — not as "no need" |
| Synthesis validation failure | Status `failed`; no partial author-facing publish |
| Author-facing presentation without examples when locators exist | Validation failure at presentation layer (future PRD) |

---

## 34. Prohibited behaviors

Explicitly prohibited:

1. Keyword-only expert selection  
2. Genre-only expert selection  
3. Recommending only experts that already exist  
4. Hiding a valid domain because no specialist exists  
5. Substituting Military expertise for Police expertise  
6. Substituting Legal expertise for Organized Crime expertise  
7. Recommending every possible expert  
8. Treating incidental mentions as central domains  
9. Presenting classifications without explanation  
10. Presenting criticism without evidence where evidence exists  
11. Using placeholders instead of meaningful examples  
12. Asking the author to select the expert team without EIC guidance  
13. Activating experts without author consent  
14. Sharing the manuscript without author consent  
15. Treating recommendation display as consent  
16. Presenting confidence as certainty  
17. Silently reconciling conflicting evidence  
18. Allowing author intent to erase contradictory manuscript evidence  
19. Allowing manuscript evidence to erase author intent  
20. Allowing specialists to rewrite authorial goals  
21. Making the Editorial Profile feel like software configuration  

---

## 35. Deferred implementation decisions

| Decision | Defer to |
|----------|----------|
| Provider-assisted vs. deterministic domain synthesis | PRD + implementation spec |
| Persistence schema / migration | PRD |
| Controlled domain vocabulary canonical file location | PRD |
| UI layout for author response | UX blueprint / PRD |
| Automated registry gap ticketing integration | Platform ops spec |
| Expert-family shared pattern libraries | Per-family propagation reviews |
| Post-expert domain analysis revision (`@v2`) | After EP-7 profile extension design |
| Calibration benchmarks for domain detection | Certification workstream |

---

## 36. Open questions

1. Should registry gaps surface to authors as expected timeline language or capability-status only?  
2. Minimum read coverage percentage before central domain claims are allowed?  
3. Should author "intentional compression" of procedure ever suppress **critical** materiality domains when plot still turns on procedure?  
4. How should domain analysis interact with Literary Agent commercial positioning without impersonation?  
5. Should fireams domain always split from police procedure capability even when one expert could cover both in future registry?  
6. Per-domain author response threading vs. recommendation-level threading?  
7. Should `storydna_knowledge_domain_analysis@v1` require separate EIC confirmation or confirm jointly with Editorial Profile activation?

---

## 37. Recommended next design artifact

Per repository governance ([README.md](../README.md) — implementation frameworks precede PRDs):

**Next artifact:** [STORYDNA Knowledge Domain Analysis and Specialist Recommendation PRD](./STORYDNA_KNOWLEDGE_DOMAIN_ANALYSIS_PRD.md) *(to be created)*

The PRD should operationalize:

- Contract `storydna_knowledge_domain_analysis@v1` field definitions
- Editorial Profile provenance linkage (Option C)
- Author-facing read model extensions for plain-English recommendations and examples
- Validation and acceptance tests
- Feature flags and rollout gates
- Registry gap behavior
- Author response persistence contract

**Not next:** Runtime code, migrations, registry seeds, or fixture changes.

---

## 38. Acceptance principles for the future PRD

1. Contract defines domain entries, recommendations, registry gap records, and provenance separately from profile sections.  
2. EIC owns analysis; specialists do not author pre-expert domain identification.  
3. Every recommendation satisfies §19 fourteen-element rule.  
4. Plain-English primary presentation; internal keys validated but not sole UX.  
5. Manuscript examples required when locators exist; fabrication forbidden.  
6. Missing specialists handled per §22 without substitution.  
7. Author consent and sharing gates preserved and tested.  
8. Author response modes and audit effects defined.  
9. Police / Organized Crime / Criminal Law worked example reproduced in acceptance fixtures.  
10. Capability propagation matrix included; registry updated.  
11. Amendment 002 advancement quality applies to EIC domain explanations.  
12. `npm run governance:capability-check` passes on PRD.  
13. No commercial enablement change without separate certification review.  
14. Current Editorial Profile fixture failures addressed by spec — fixture change is implementation task, not PRD scope creep.  

---

## Appendix A — Example knowledge domains (non-exhaustive)

Examples demonstrate the framework — they do **not** form a closed list.

| Domain | Illustrative manuscript signals |
|--------|--------------------------------|
| Police procedure | Investigations, interviews, arrests, warrants, evidence handling, chain of custody, command structure, jurisdiction, tactical entries, informants, internal affairs |
| Organized crime | Mob hierarchy, crew structure, discipline, criminal enterprises, racketeering, informant culture, loyalty, retaliation, succession, law-enforcement relations, money movement |
| Criminal law and prosecution | Charging, warrants, evidentiary questions, pleas, cooperation agreements, grand jury, witness prep, admissibility, prosecution strategy |
| Courts and litigation | Trial procedure, motions, judicial rulings, civil litigation mechanics |
| Military operations | Tactical planning, command structure, deployment, rules of engagement, logistics — **when materially on page** |
| Firearms | Weapon handling, ballistics materially affecting plot |
| Intelligence and counterterrorism | Tradecraft, agency procedure, classification handling |
| Medicine and trauma | Clinical treatment, injury recovery, cause of death — when plot-dependent |
| Psychology | Clinical or forensic psychology when materially invoked |
| Forensics | Lab methods, DNA, trace evidence driving plot |
| Cybersecurity | Hacking, infosec procedure affecting causality |
| Finance and white-collar crime | Fraud schemes, markets, regulatory investigation |
| Government and politics | Institutional decision-making affecting plot |
| Religion | Ritual, clerical structure, theological dispute when material |
| History | Period accuracy affecting reader trust |
| Geography and local culture | Place-specific authenticity |
| Science and technology | Technical systems driving plot |
| Disability and accessibility | Representational accuracy affecting trust |
| Cultural or lived-experience authenticity | Identity, community, or experience portrayed materially |

One manuscript may require several domains; importance may differ by version, chapter, scene, or arc.

---

## Appendix B — Worked example: Police and Organized Crime manuscript

**Manuscript premise (design example):** A literary crime novel centered on a detective unit investigating a mob-linked racket while preparing a major wire and arrest sequence. No sustained military operations appear on the page.

### B.1 Police Procedure — **central domain**

**Why central:** Police work drives the investigation spine and multiple turning points — not backdrop.

**Manuscript evidence (illustrative locators):**

| Locator | Observation |
|---------|-------------|
| Ch. 3 | Detective squad briefing assigns surveillance roles and chain of command |
| Ch. 9 | Interrogation scene — suspect waiver, attorney request, interview termination |
| Ch. 12 | Affidavit drafting and judge sign-off for wiretap |
| Ch. 14 | Evidence logging, property room intake, chain-of-custody challenge by defense |
| Ch. 18 | Tactical entry planning with jurisdiction coordination |

**Materiality:** Critical — procedural choices turn plot and reader trust for crime readership.  
**Confidence:** High — recurring locators across acts.  
**Recommendation (plain English):**

> "Police work is not background here — it drives your investigation and several major reversals. Your interview, warrant, evidence-handling, and entry scenes in Chapters 3, 9, 12, 14, and 18 are the kind of material informed readers evaluate against real procedure. I recommend a Police Procedures capability review that scope if you approve adding that specialist to your team and sharing the manuscript."

**Capability mapping:** `police_procedure` capability → registry lookup → if unavailable, **registry gap** statement (not Military substitute).

### B.2 Organized Crime — **central domain**

**Why central:** Criminal organization structure and enterprise logic drive antagonist causality and mid-book escalation.

**Manuscript evidence:**

| Locator | Observation |
|---------|-------------|
| Ch. 2 | Crew hierarchy introduced — captain, soldiers, earner roles |
| Ch. 7 | Internal discipline scene for skimming |
| Ch. 11 | Racket payments, front business, kickback pattern |
| Ch. 15 | Informant handling by organization — loyalty and retaliation stakes |
| Ch. 20 | Leadership succession dispute affects climax cooperation with law enforcement |

**Materiality:** Critical.  
**Confidence:** High.  
**Recommendation:**

> "Your antagonist organization is not decorative — hierarchy, discipline, and criminal enterprise logic drive Act II and the climax. Readers who know crime fiction will judge whether the mob behaves coherently. I recommend an Organized Crime authenticity capability review focused on hierarchy, enterprise mechanics, informant culture, and retaliation logic."

**If registry gap:**

> "StoryDNA has identified this need, but an appropriate Organized Crime specialist is not yet available in the current editorial team. I am recording that gap and will not substitute an unrelated expert."

### B.3 Criminal Law / Prosecutorial Practice — **substantial supporting domain**

**Why not central but material:** Prosecution material supports turning points but investigation spine dominates.

**Manuscript evidence:**

| Locator | Observation |
|---------|-------------|
| Ch. 12 | Wire affidavit standard and prosecutorial approval |
| Ch. 16 | Charging conference — cooperation offer framing |
| Ch. 19 | Grand jury presentation referenced; admissibility dispute foreshadowed |

**Materiality:** High.  
**Confidence:** Medium — prosecution scenes present but less frequent than investigation scenes.  
**Sequencing:** Early-to-mid — charging and admissibility affect whether investigation payoff reads credibly.  
**Recommendation:**

> "Several turning points depend on charging decisions, cooperation offers, and evidentiary admissibility — not only on detective work. A Criminal Law or Prosecutorial Practice capability should review Chapters 12, 16, and 19 so your legal consequences match the investigation you built."

**Distinct from Police Procedure:** Legal strategy ≠ detective procedure. Do not collapse.

### B.4 Domains evaluated but not recommended

| Domain | Classification | Rationale |
|--------|----------------|-----------|
| Military operations | Incidental mention | Character veteran backstory in Ch. 5 — no tactical plot dependency |
| Firearms | Limited scene-specific | Single range scene Ch. 8 — moderate materiality; conditional low-priority review |
| Medical trauma | Insufficient evidence in read | ER scene referenced; coverage incomplete for Act III — stated uncertainty |

### B.5 Anti-pattern corrected (fixture finding)

**Wrong (observed design failure):** Recommending Military Expert as primary domain support for this manuscript.

**Correct:** Military capability **not currently recommended** — no sustained military materiality. Police Procedure and Organized Crime are central; Criminal Law is substantial supporting. Missing Organized Crime capability → registry gap honesty.

---

## Appendix C — Design relationship to current UI feedback

The following author-experience failures were observed in the first author-facing Editorial Profile dev fixture review. Treat as **design findings**:

| Finding | Framework correction |
|---------|---------------------|
| Language too abstract | §23 plain-English requirements |
| Criticism insufficiently explained | §19 fourteen-element recommendations; §23 structure |
| Generic / placeholder examples | §24 manuscript-example requirements |
| Major domains missing from recommendations | §11 lifecycle + §13 detection principles + Option C artifact |
| Report-like rather than discussion | §25 author response requirements |
| Author cannot respond to observations | §25 dialogue modes + audit effects |
| Military surfaced; Police / Organized Crime not | §14 materiality threshold + §34 prohibitions + Appendix B |

Implementation teams are not criticized here — the fixture exposed a missing design layer this framework supplies.

---

## Appendix D — Contract sketch (design reference only)

`storydna_knowledge_domain_analysis@v1` — fields for PRD elaboration:

| Field | Notes |
|-------|-------|
| `analysis_id` | Stable identity |
| `manuscript_version_id` | Edition scope |
| `independent_read_id` | Source read |
| `status` | Lifecycle enum |
| `domains` | DomainEntry[] — key, centrality, materiality, confidence, evidence |
| `recommendations` | SpecialistRecommendation[] — plain-English + mapping + sequencing |
| `registry_gaps` | RegistryGapEntry[] |
| `author_responses` | ResponseEntry[] — append-only |
| `provenance` | Linked artifact IDs |
| `is_expert_finding` | Always `false` |

**No runtime implementation authorized by this sketch.**

---

## Acceptance criteria (this framework document)

1. All 38 required sections present.  
2. Capability propagation evaluated at five levels — EIC ownership confirmed.  
3. Police Procedure, Organized Crime, and Criminal Law worked example included.  
4. Missing-specialist behavior defined.  
5. Plain-English and manuscript-example requirements defined.  
6. Author response and consent gates defined.  
7. Editorial Profile integration Option C recommended with rationale.  
8. Five concepts distinguished: domains, capabilities, experts, assignments, roadmap actions.  
9. Current fixture design findings addressed.  
10. Next artifact identified as PRD.  
11. `npm run governance:capability-check` passes on this document.  

---

## Conformance

- **Registry:** `cap.knowledge_domain_analysis` recorded in [CAPABILITY_REGISTRY.json](../capabilities/CAPABILITY_REGISTRY.json)
- **Conformance:** `npm run governance:capability-check -- docs/governance/implementation/STORYDNA_KNOWLEDGE_DOMAIN_ANALYSIS_FRAMEWORK.md`
