# StoryDNA Conversational Intelligence Framework

**Document type:** Platform architecture design (no runtime implementation)  
**Owner:** Kevin Track / StoryDNA Editorial Organization  
**Branch baseline:** `feature/eic-phase-1a-author-intent`  
**Constitution baseline:** v1.0 + Amendment 001 (RATIFIED)  
**Related artifacts:** [EIC_CONVERSATIONAL_INTAKE_AND_TEAM_APPROVAL_UX_BLUEPRINT.md](./EIC_CONVERSATIONAL_INTAKE_AND_TEAM_APPROVAL_UX_BLUEPRINT.md), [EIC_PHASE_1B_A_WELCOME_ELEVATOR_PITCH_ACKNOWLEDGMENT_PRD.md](./EIC_PHASE_1B_A_WELCOME_ELEVATOR_PITCH_ACKNOWLEDGMENT_PRD.md)

---

## Constitution Compliance

```json
{
  "applicable_sections": ["§0", "§1", "§10", "§12", "§13", "§14"],
  "compliance_explanation": "Conversational Intelligence implements §0 Editorial Mission by enabling the EIC to understand author goals through professional dialogue before orchestration. §1 Author Intent is preserved: understanding is author-originated, not expert judgment. §10 EIC governance: the framework assigns conversational orchestration to the EIC without producing expert findings. §12 author rights: authors own their answers, may edit, confirm, or reject summaries before independent read. §13 burden of proof: editorial understanding is explicitly not manuscript evidence, not Author Intent records, and not Canon. §14 conformance tests defined in Section 14. Amendment 001 capability review completed below.",
  "amendment_required": "No",
  "backward_compatibility_impact": "Additive platform layer. Phase 1A Author Intent form, Phase 1B-a manuscript brief intake, and existing expert workflows remain when conversational intelligence flags are off. Editorial understanding is a new contract; it does not overwrite storydna_author_intent@v1 or storydna_author_manuscript_brief@v1.",
  "certification_impact": "No expert commercially enabled. No provider calls in framework design. Conversational intelligence is orchestration infrastructure only."
}
```

---

## Capability Propagation Review

```json
{
  "new_capability_introduced": "Conversational Intelligence (storydna_conversational_intelligence@v1)",
  "existing_capability_modified": "EIC conversational intake UX; Phase 1B-a manuscript brief intake; future expert interview flows",
  "classification": "platform_wide",
  "existing_experts_evaluated": ["literary_agent", "military_expert", "developmental_editor", "editor_in_chief"],
  "future_experts_affected": ["character_expert", "line_editor", "continuity_expert", "timeline_expert", "archivist", "producer", "screenplay_editor"],
  "editor_in_chief_impact": "EIC is the first consumer: conversational intake, confidence evaluation, author confirmation, and editorial understanding persistence. EIC owns the interview orchestration layer; it does not produce retained expert findings.",
  "platform_impact": "New platform-wide conversation engine, response-type taxonomy, confidence model, editorial understanding contract, and reusable stage machine. Future experts may adopt the same framework for domain-specific interviews.",
  "certification_impact": "No commercial enablement. Framework governs pre-recruitment author dialogue only. Expert-specific interviews require separate capability reviews before reuse.",
  "propagation_decision": "move_to_platform",
  "review_artifact_path": "docs/governance/implementation/STORYDNA_CONVERSATIONAL_INTELLIGENCE_FRAMEWORK.md"
}
```

### Sub-capability classifications (reviewed)

| Sub-capability | Classification | Propagation decision | Rationale |
|----------------|----------------|---------------------|-----------|
| Conversation stage machine | platform_wide | move_to_platform | Reusable across EIC and future expert interviews |
| Response type taxonomy (A/B/C) | platform_wide | move_to_platform | Deterministic editorial voice rules |
| Confidence evaluation model | platform_wide | move_to_platform | Shared understanding-quality gate |
| Editorial understanding persistence | platform_wide | move_to_platform | Cross-cutting author-goals artifact |
| Author confirmation gate | platform_wide | move_to_platform | Author-rights gate before independent read |
| EIC intake interview scripts | editor_in_chief_owned | move_to_editor_in_chief | EIC-specific stage content and prompts |
| Expert domain interview scripts | expert_family | defer_pending_certification | Per-expert scripts require separate review |

---

## 1. Vision

StoryDNA conversations should feel like sitting with a professional Editor-in-Chief at a world-class publishing house — not filling out a survey, chatting with a generic chatbot, or enduring an AI interview.

The Conversational Intelligence Framework is a **platform-wide architectural layer** that governs how StoryDNA conducts structured editorial dialogue. It is not EIC-only. The EIC is the first consumer (author intake), but the same engine, response rules, confidence model, and understanding contract must support future interviews led by Literary Agents, Producers, Screenplay editors, Series continuity specialists, and Character experts.

### Design north star

| Feels like | Does not feel like |
|------------|-------------------|
| A thoughtful publishing-house conversation | A configuration form with chat skin |
| One professional voice, one response per turn | Rapid-fire Q&A or interrogation |
| Listening, reflecting, clarifying when necessary | Assumption-making or fact invention |
| Warm, confident, editorially literate | Robotic, therapeutic, or flattering |

### Architectural separation

```
┌─────────────────────────────────────────────────────────────┐
│  CONVERSATIONAL INTELLIGENCE (platform layer)               │
│  - Stage machine, response types, confidence model          │
│  - Editorial understanding contract                         │
│  - Author confirmation gate                                 │
└──────────────────────────┬──────────────────────────────────┘
                           │ consumed by
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
   EIC author intake   Literary Agent    Character expert
   (Phase 1B+)         interview         interview (future)
```

**Hard boundary:** Conversational Intelligence produces **editorial understanding** — the evolving EIC (or expert) comprehension of author goals. It does **not** produce manuscript evidence, Author Intent records, Canon, or expert findings.

---

## 2. Constitution Compliance

This framework satisfies the constitutional order:

1. **§0 Editorial Mission** — The EIC understands author goals before recruiting specialists.
2. **§1 Author Intent** — Goals originate from the author in their own words; understanding is derived from conversation, not expert judgment.
3. **§10 EIC Governance** — The EIC orchestrates intake; experts are not recruited during conversation.
4. **§12 Author Rights** — Author owns answers, may edit, skip optional stages, save draft, and must confirm understanding before independent read.
5. **§13 Burden of Proof** — Editorial understanding is labeled author-provided framing; it is never manuscript evidence and never overrides independent professional judgment.
6. **§14 Conformance** — Acceptance criteria in Section 14 define testable invariants.

**Amendment 001:** Capability Propagation Review completed above. Registry entry `cap.conversational_intelligence` added.

---

## 3. Capability Propagation Review

See the JSON block at the top of this document and sub-capability table above.

**Registry entry:** `cap.conversational_intelligence`  
**Classification:** `platform_wide`  
**First implementation:** EIC Phase 1B conversational intake (design phase; runtime deferred)

---

## 4. Conversation Rules

Every conversational stage follows the same deterministic cycle:

```
┌──────────────┐
│   QUESTION   │  EIC (or expert) asks one stage question
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   RESPONSE   │  Author answers in their own words
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  CONFIDENCE  │  System evaluates: understood enough?
│  EVALUATION  │
└──────┬───────┘
       │
       ├─ YES ──► ONE EIC response (Type A or B) ──► NEXT STAGE
       │
       └─ NO  ──► ONE EIC response (Type C) ──► Author answers ──►
                  ONE EIC response (Type A) ──► NEXT STAGE
```

### Invariants

| Rule | Description |
|------|-------------|
| One question per stage | Each stage presents exactly one primary question |
| One EIC response per turn | After author input, exactly one EIC message before next action |
| Deterministic follow-up | Confidence evaluation is rule-based; no open-ended multi-turn loops |
| Max one clarification | At most one Type C clarification per stage |
| No expert UI during intake | No expert lists, intent enums, or checklists in conversation stages |
| Author words preserved | Raw author text stored; EIC responses do not overwrite author input |
| Stage order fixed per interview | Interview scripts define stage sequence; skipping optional stages allowed |

### Stage definition

A **stage** is the atomic unit of conversation:

- `stage_id` — stable identifier (e.g., `eic_intake.primary_vision`)
- `question` — the EIC prompt for this stage
- `required` — whether author must answer before proceeding
- `understanding_field` — which editorial understanding field this stage populates
- `confidence_threshold` — minimum confidence to advance without clarification

---

## 5. Response Types

Exactly three response types exist. No other EIC conversational response is permitted during intake.

### Type A — Acknowledgment

**Purpose:** Confirm the EIC heard the author. No question. No new information.

**When used:** Confidence evaluation returns YES; author answer is sufficient.

**Characteristics:**
- Brief, professional, warm
- Does not repeat author text verbatim unless quoting a short phrase
- Does not introduce assumptions or new facts
- Does not ask a question

**Examples:**

> Thank you — that's clear.

> I have what I need for this part.

> That gives me a solid picture of your intent here.

---

### Type B — Reflection

**Purpose:** Mirror back what the author said using the author's own framing. No question. No assumptions.

**When used:** Confidence evaluation returns YES; reflection adds value by showing the EIC understood nuance (long or complex answers, emotionally weighted responses, ambiguous market positioning).

**Characteristics:**
- Opens with reflective framing: "You mentioned…", "I heard…", "It sounds like…"
- Restates only what the author stated
- Does not infer unstated goals, market categories, or reader demographics
- Does not ask a question
- Does not flatter or evaluate quality

**Examples:**

> You mentioned you're aiming for readers who want the tactical detail without losing the emotional core — I'll keep that in mind.

> I heard that success, for you, means a query-ready manuscript with the military realism already vetted.

> It sounds like you're still finding your market position, and that's useful context.

---

### Type C — Clarification

**Purpose:** Ask exactly one clarifying question when the answer materially affects editorial planning and confidence is below threshold.

**When used:** Confidence evaluation returns NO; a specific gap would change how the EIC plans the independent read or future expert recruitment.

**Characteristics:**
- Exactly one question
- Must state why clarification matters (briefly, without lecturing)
- Must not assume facts not in the author's answer
- Must not ask compound or multi-part questions
- Max one Type C per stage; after author answers, proceed with Type A and next stage

**Examples:**

> When you say "query-ready," do you mean ready for literary agents specifically, or a broader polish before self-publishing?

> You described the reader as "people like me" — can you say a bit more about who that is?

**Forbidden:**

> What genre is it, who is your audience, and what's your timeline? *(compound)*
> That sounds like literary fiction — is that right? *(assumption)*

---

## 6. Clarification Rules

### Follow-up decision model

Deterministic evaluation after every author response:

```
understood_enough(stage, author_response, editorial_understanding)?
  │
  ├─ YES → emit Type A or Type B → advance to next stage
  │
  └─ NO  → emit Type C (one question) → await author response
              → emit Type A → advance to next stage
```

### When clarification is permitted

A Type C question is allowed **only if all** of the following are true:

1. Confidence for the stage's understanding field is below `confidence_threshold`
2. The missing information **materially affects** editorial planning (independent read focus, expert recruitment, or success criteria)
3. No Type C has already been emitted for this stage
4. The gap cannot be resolved by accepting `"unsure"` or equivalent author uncertainty

### When clarification is forbidden

| Condition | Action |
|-----------|--------|
| Answer is vague but editorially sufficient | Type A or B; record open question |
| Author says "unsure" or "I don't know yet" | Accept; Type A; no clarification |
| Clarification already used this stage | Type A; record open question; advance |
| Gap is stylistic preference, not planning | Type A; do not clarify |
| Clarification would not change expert selection | Type A; do not clarify |

### Resolved clarifications

When a Type C is answered, the Q&A pair is appended to `resolved_clarifications[]` on the editorial understanding record with timestamp and stage reference.

---

## 7. Confidence Model

Confidence is a **deterministic, stage-level score** representing how well the EIC understands the author's intent for a given understanding field. It is not a model-generated probability in Phase 1; rules are explicit and testable.

### Confidence levels

| Level | Range | Meaning |
|-------|-------|---------|
| `low` | 0.0 – 0.39 | Insufficient for editorial planning; clarification required if material |
| `adequate` | 0.40 – 0.69 | Sufficient to proceed; open question may be recorded |
| `high` | 0.70 – 1.0 | Clear understanding; no clarification needed |

### Confidence inputs (deterministic rules)

| Signal | Effect |
|--------|--------|
| Required field answered with ≥ min character count | +0.30 base |
| Answer contains specific concrete nouns (reader, market, outcome) | +0.15 |
| Author explicitly says "unsure" / "don't know" | Set to 0.50 (adequate); no clarification |
| Answer is single word or ≤ 5 characters | Cap at 0.25 |
| Type C answered with substantive response | Set to ≥ 0.70 |
| Optional stage skipped | Field null; stage confidence N/A |

### Aggregate confidence

`confidence.overall` is the weighted mean of required-stage confidences:

| Field | Weight |
|-------|--------|
| primary_vision | 0.25 |
| creative_motivation | 0.15 |
| target_reader | 0.15 |
| desired_reader_experience | 0.10 |
| market_position | 0.15 |
| success_definition | 0.20 |

**Gate:** Author confirmation (Section 9) requires `confidence.overall ≥ 0.60` and all required fields populated.

### Confidence increases through interview

- Each stage completion updates field-level confidence
- Clarification resolution boosts field confidence to ≥ 0.70
- Author confirmation sets `confidence.confirmed_at` and locks pre-read understanding snapshot

---

## 8. Editorial Understanding Model

### Contract: `storydna_editorial_understanding@v1`

A new platform object representing the EIC's evolving understanding of author goals. This is **not** manuscript evidence, **not** an Author Intent record, and **not** Canon.

```json
{
  "contract_version": "storydna_editorial_understanding@v1",
  "understanding_id": "uuid",
  "book_id": "uuid",
  "manuscript_id": "uuid",
  "manuscript_version_id": "uuid",
  "interview_type": "eic_author_intake | literary_agent_intake | character_interview | series_intake | producer_intake | screenplay_intake",
  "conducted_by": "editor_in_chief | literary_agent | character_expert | producer | screenplay_editor",
  "primary_vision": "string | null",
  "target_reader": "string | null",
  "desired_reader_experience": "string | null",
  "market_position": "string | null",
  "creative_motivation": "string | null",
  "success_definition": "string | null",
  "open_questions": [
    {
      "stage_id": "string",
      "question": "string",
      "recorded_at": "timestamp"
    }
  ],
  "confidence": {
    "overall": "number (0.0–1.0)",
    "by_field": {
      "primary_vision": "number | null",
      "target_reader": "number | null",
      "desired_reader_experience": "number | null",
      "market_position": "number | null",
      "creative_motivation": "number | null",
      "success_definition": "number | null"
    },
    "confirmed_at": "timestamp | null",
    "confirmed_by": "string | null"
  },
  "resolved_clarifications": [
    {
      "stage_id": "string",
      "clarification_question": "string",
      "author_response": "string",
      "resolved_at": "timestamp"
    }
  ],
  "conversation_history": [
    {
      "turn_id": "uuid",
      "stage_id": "string",
      "role": "eic | author",
      "response_type": "question | type_a | type_b | type_c | author_answer | confirmation_summary | author_confirmation",
      "content": "string",
      "timestamp": "timestamp"
    }
  ],
  "understanding_summary": "string | null",
  "version": "integer (monotonic)",
  "status": "in_progress | awaiting_confirmation | confirmed | superseded | cancelled",
  "is_manuscript_evidence": false,
  "is_author_intent": false,
  "is_canon": false,
  "created_by": "string",
  "created_at": "timestamp",
  "updated_at": "timestamp",
  "confirmed_at": "timestamp | null",
  "supersedes_understanding_id": "uuid | null",
  "superseded_at": "timestamp | null"
}
```

### Field rules

| Field | Required at confirmation | Notes |
|-------|-------------------------|-------|
| primary_vision | Yes | What the manuscript is about; author's words distilled, not invented |
| target_reader | Yes | Who the book is for; `"unsure"` is valid |
| desired_reader_experience | No | Null if optional stage skipped |
| market_position | Yes | Where it sits in the market; `"unsure"` is valid |
| creative_motivation | Yes | Why the author wrote it |
| success_definition | Yes | What success looks like at this stage |
| open_questions | No | Populated when confidence adequate but gaps noted |
| understanding_summary | Yes at confirmation | EIC-generated summary for author confirmation screen |

### Metadata invariants (computed, not author-editable)

| Flag | Value | Meaning |
|------|-------|---------|
| `is_manuscript_evidence` | `false` | Never treated as on-page evidence |
| `is_author_intent` | `false` | Distinct from storydna_author_intent@v1 |
| `is_canon` | `false` | Not series canon or continuity fact |

### Status transitions

```
in_progress → awaiting_confirmation (all required stages complete)
awaiting_confirmation → confirmed (author confirms summary)
awaiting_confirmation → in_progress (author selects "Edit My Answers")
confirmed → superseded (new understanding for same version)
in_progress → cancelled (author abandons)
```

### Relationship to other contracts

| Contract | Relationship |
|----------|-------------|
| `storydna_author_manuscript_brief@v1` | Brief may populate initial understanding fields; understanding is the EIC's interpreted record |
| `storydna_author_intent@v1` | Intent derived from confirmed understanding in Phase 1B-b; not auto-created on confirmation |
| Manuscript evidence | No relationship; understanding never cited as evidence |
| `storydna_eic_vision_alignment@v1` | Post-read assessment references confirmed understanding as "author stated vision" |

---

## 9. Author Confirmation

Before the EIC begins an independent read, the author must confirm that the EIC understood them correctly.

### Confirmation gate

```
All required stages complete
        │
        ▼
confidence.overall ≥ 0.60
        │
        ▼
EIC presents understanding_summary
        │
        ▼
"Did I understand you correctly?"
        │
   ┌────┴────┐
   │         │
  YES    Edit My Answers
   │         │
   ▼         ▼
confirmed   Return to in_progress
   │         (preserves prior answers as draft)
   ▼
Independent read may begin
```

### Confirmation screen copy

**Section header:** Before I read your manuscript

**EIC summary template:**

> Here's what I understand about your project:
>
> **Your story:** {primary_vision}
>
> **Your reader:** {target_reader}
>
> **The experience you want:** {desired_reader_experience or "You skipped this — that's fine."}
>
> **Market position:** {market_position}
>
> **Why you wrote it:** {creative_motivation}
>
> **Success for you:** {success_definition}
>
> Did I understand you correctly?

**Primary button:** Yes

**Secondary button:** Edit My Answers

### Post-confirmation

| Action | Effect |
|--------|--------|
| **Yes** | `status → confirmed`; `confirmed_at` set; independent read gate opens |
| **Edit My Answers** | `status → in_progress`; author returns to stage list with answers preserved; confirmation summary regenerated on re-completion |

**Hard rule:** No provider call, no manuscript read, and no expert recruitment until `status = confirmed`.

---

## 10. Conversation Style Guide

### Voice

Professional, thoughtful, warm, confident — the voice of a senior editor at a respected publishing house.

### Always

- Use plain, precise language
- Acknowledge the author's effort without exaggeration
- Respect uncertainty ("unsure" is valid data)
- Keep responses concise (Type A: 1–2 sentences; Type B: 2–3 sentences; Type C: 1 question + optional brief context)
- Label author-provided content distinctly from EIC assessment in confirmation summary

### Never

| Anti-pattern | Example (forbidden) |
|--------------|---------------------|
| Flattery | "What a brilliant concept!" |
| Exaggeration | "This will definitely be a bestseller." |
| Inventing facts | "So your protagonist is a veteran…" *(not stated)* |
| Robotic phrasing | "Processing your response. Next question." |
| Therapist voice | "It sounds like you're going through a lot." |
| Unnecessary questions | Asking when confidence is already adequate |
| Verbatim repetition | Repeating entire author answer back word-for-word |
| Assumption framing | "So you're writing literary fiction, then?" |
| Expert impersonation | "As your Literary Agent, I'd say…" during EIC intake |

### Quoting

Short direct quotes (≤ 15 words) are permitted in Type B reflections when they anchor understanding. Full verbatim repetition is forbidden.

### EIC intake stage script (reference)

| Stage | Question |
|-------|----------|
| Welcome | *(Type A only — no question; sets context)* |
| Primary vision | In a few sentences, what is this manuscript about? |
| Creative motivation | Why did you write this book? What made it worth your time? |
| Target reader | Who is this book for? |
| Reader experience | What experience do you want readers to have — emotionally, intellectually, or viscerally? *(optional)* |
| Market position | Where do you see this manuscript in the market? |
| Success definition | What would success look like for you at this stage? |

---

## 11. Platform Integration

### Layer placement

```
Studio UI
    │
    ▼
Conversational Intelligence Engine (platform)
    ├── Stage machine
    ├── Response type emitter (A / B / C)
    ├── Confidence evaluator
    └── Editorial understanding service
    │
    ├──► EIC Author Intake (Phase 1B — first consumer)
    ├──► Manuscript brief bridge (storydna_author_manuscript_brief@v1)
    ├──► Author Intent derivation (Phase 1B-b → storydna_author_intent@v1)
    └──► Independent read gate (requires confirmed understanding)
```

### Integration points

| System | Integration |
|--------|-------------|
| Phase 1B-a brief intake | Brief fields seed understanding; framework replaces static prompt flow |
| Phase 1A Author Intent | Confirmed understanding derives intent in 1B-b; form remains fallback |
| EIC entry gate | Checks confirmed understanding (future) or active intent (current) |
| Expert Desk | No change until post-approval; understanding not shared with experts pre-permission |
| Feature flags | `STUDIO_CONVERSATIONAL_INTELLIGENCE` master gate (proposed) |

### Framing versus evidence (platform rule)

| Property | Editorial understanding | Manuscript evidence |
|----------|------------------------|---------------------|
| Source | Author conversation | Authoritative manuscript text |
| `is_manuscript_evidence` | `false` | `true` |
| Shown to experts pre-permission | No | No |
| Overrides EIC judgment | No — informs only | N/A |
| UI label | "What you told me" | "From the manuscript" |

---

## 12. Implementation Roadmap

**Design phase only.** No runtime code, migrations, or providers in this task.

| Phase | Scope | Depends on |
|-------|-------|------------|
| **CI-0** | Framework design + governance (this document) | Amendment 001 |
| **CI-1** | Types, validation, confidence rules (`lib/conversational-intelligence/`) | CI-0 |
| **CI-2** | Editorial understanding service + migration | CI-1 |
| **CI-3** | Stage machine + response emitter | CI-2 |
| **CI-4** | EIC intake integration (replaces Phase 1B-a static prompts) | CI-3 |
| **CI-5** | Author confirmation gate + independent read unlock | CI-4 |
| **CI-6** | Brief → understanding bridge; intent derivation | CI-5 |
| **CI-7** | Expert interview adapter (Literary Agent, Character, etc.) | CI-3 + per-expert review |

### Explicitly out of scope for CI-0 through CI-5

- Provider calls for response generation (deterministic templates first)
- Model-assisted confidence (deferred; rules-first)
- Expert workflow launch
- Manuscript text access during conversation

---

## 13. Risks

| Risk | Mitigation |
|------|------------|
| Conversation feels like a form with chat bubbles | Response type rules enforce editorial voice; one question per stage; Type B reflections |
| EIC inventing author goals | Type B forbids assumptions; understanding fields store author-derived text only |
| Clarification loops | Max one Type C per stage; deterministic advance after clarification answer |
| Understanding confused with Author Intent | Separate contract; `is_author_intent: false`; derivation deferred to Phase 1B-b |
| Understanding leaked as manuscript evidence | `is_manuscript_evidence: false`; UI labels; expert-context injection policies |
| Model drift in future model-assisted mode | Phase 1 deterministic templates; model assist requires separate review |
| Authors skip confirmation | Hard gate: no independent read without `status = confirmed` |
| Platform reuse premature | Expert interviews require separate Capability Propagation Reviews |

---

## 14. Acceptance Criteria

1. Framework document defines exactly three response types (A, B, C) with no additional types.
2. Every stage follows Question → Response → Confidence → One EIC response → Next stage.
3. Max one Type C clarification per stage is enforced in design rules.
4. Follow-up decision model is deterministic (understood enough → A/B; not enough → C → A → next).
5. `storydna_editorial_understanding@v1` contract includes all required fields with evidence/intent/canon flags false.
6. Author confirmation gate blocks independent read until author selects Yes.
7. Conversation style guide forbids flattery, invention, robotic, and therapist patterns.
8. Platform-wide classification documented; EIC is first consumer, not sole consumer.
9. Relationship to brief, intent, and evidence contracts is explicit.
10. `cap.conversational_intelligence` registered in CAPABILITY_REGISTRY.json.
11. `npm run governance:capability-check` passes on this document.
12. No runtime code, migrations, or providers in this design task.

---

## 15. Future Expansion

The Conversational Intelligence Framework is designed for reuse beyond EIC author intake. Each future consumer requires its own Capability Propagation Review before implementation.

### Planned interview types

| Interview | `interview_type` | `conducted_by` | Stages (design-only) |
|-----------|-----------------|----------------|---------------------|
| EIC author intake | `eic_author_intake` | `editor_in_chief` | Vision, motivation, reader, market, success |
| Literary Agent pitch | `literary_agent_intake` | `literary_agent` | Hook, comp titles, positioning, submission readiness |
| Producer package | `producer_intake` | `producer` | Logline, tone, audience, format, attachment needs |
| Screenplay development | `screenplay_intake` | `screenplay_editor` | Visual tone, structure goals, comparable films, draft stage |
| Series continuity | `series_intake` | `editor_in_chief` | Series arc, book role, canon constraints, reader continuity |
| Character deep-dive | `character_interview` | `character_expert` | Character goals, contradictions, arc intent, relationship priorities |

### Reuse model

Shared platform components:

- Stage machine and turn sequencing
- Response types A / B / C
- Confidence evaluation rules (parameterized per interview)
- Editorial understanding contract (extended fields per interview type)
- Author confirmation gate pattern

Per-consumer customization:

- Stage scripts and questions
- Confidence thresholds and weights
- Understanding field mapping
- Post-confirmation downstream action (independent read vs. expert analysis)

### Extension path

New interview types add optional fields to `storydna_editorial_understanding@v1` via versioned extension (`@v2`) rather than parallel contracts, preserving a single platform understanding object with `interview_type` discrimination.

---

## Governance

- **Registry:** `cap.conversational_intelligence` in [CAPABILITY_REGISTRY.json](../capabilities/CAPABILITY_REGISTRY.json)
- **Conformance:** `npm run governance:capability-check -- docs/governance/implementation/STORYDNA_CONVERSATIONAL_INTELLIGENCE_FRAMEWORK.md`
