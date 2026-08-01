---
no_new_capability: true
rationale: Consolidated propagation review for eight capabilities declared in Amendment 002; does not introduce additional capabilities beyond that amendment.
---

# Amendment 002 — Capability Propagation Review

**Review date:** 2026-08-01  
**Authority:** Amendment 001 (RATIFIED) + Amendment 002 (PROPOSED)  
**Reviewer:** StoryDNA Governance (Kevin Track)  
**Status:** Complete — pending Amendment 002 ratification before runtime implementation

## Constitution Compliance

```json
{
  "applicable_sections": ["Amendment 001", "§14", "Amendment 002"],
  "compliance_explanation": "Per-capability propagation reviews for eight capabilities introduced by Amendment 002. Each evaluated against seven propagation questions. No auto-approval without documented reasoning.",
  "amendment_required": "No",
  "backward_compatibility_impact": "None until individual capabilities ship under feature flags.",
  "certification_impact": "Calibration benchmark required for provider-assisted synthesis; expert reuse requires per-expert certification review."
}
```

---

## Summary Table

| # | Capability | ID | Classification | Decision |
|---|------------|-----|----------------|----------|
| 1 | Progressive Editorial Understanding | `cap.progressive_editorial_understanding` | `platform_wide` | move_to_platform |
| 2 | Understanding-confidence model | `cap.understanding_confidence_model` | `platform_wide` | move_to_platform |
| 3 | Conversational advancement quality gate | `cap.conversational_advancement_quality_gate` | `platform_wide` | move_to_platform |
| 4 | Grounded synthesis | `cap.grounded_synthesis` | `platform_wide` | move_to_platform |
| 5 | EIC understanding summary | `cap.eic_understanding_summary` | `editor_in_chief_owned` | move_to_editor_in_chief |
| 6 | Author confirmation | `cap.editorial_understanding_confirmation` | `platform_wide` | move_to_platform |
| 7 | Adaptive clarification | `cap.adaptive_clarification` | `platform_wide` | move_to_platform |
| 8 | Encouraging-but-honest standard | `cap.encouraging_honest_conversational_standard` | `editorial_board_shared` | propagate_to_editorial_board |

---

## 1. Progressive Editorial Understanding

**Capability ID:** `cap.progressive_editorial_understanding`  
**Classification:** `platform_wide`  
**Propagation decision:** `move_to_platform`

### Description

Constitutional principle and runtime enforcement that every author interaction must deepen evidence-grounded editorial understanding. Governs response quality, anti-echo, and synthesis requirements across all StoryDNA conversational surfaces.

### Seven propagation questions

| Question | Answer |
|----------|--------|
| Remain unique to one expert? | **No** — applies to EIC intake and all future expert interviews |
| Similar experts receive it? | **Yes** — all finding-producing experts conducting author dialogue |
| Every expert receive it? | **Yes** — when expert conducts conversational intake |
| EIC owns it? | **Partially** — EIC is first consumer; principle is platform-wide |
| Platform-wide? | **Yes** |
| Retroactive to existing experts? | **Later** — ME/LA do not conduct intake today; apply when conversational expert flows ship |
| Future experts inherit automatically? | **Yes** — subject to Amendment 001 review per expert domain |

### Reasoning

The founder requirement ("every response must advance understanding") is not domain-specific. Isolating it to EIC would allow expert interviews to degrade into echo chambers. Platform-wide classification ensures consistent author experience.

### Certification impact

Calibration benchmark fixture set required. No commercial expert enablement impact.

---

## 2. Understanding-Confidence Model

**Capability ID:** `cap.understanding_confidence_model`  
**Classification:** `platform_wide`  
**Propagation decision:** `move_to_platform`

### Description

Seven non-gamified confidence dimensions with five levels (insufficient → author-confirmed). Replaces arbitrary percentage display with honest qualitative states.

### Seven propagation questions

| Question | Answer |
|----------|--------|
| Remain unique to one expert? | **No** |
| Similar experts receive it? | **Yes** — parameterized weights per interview type |
| Every expert receive it? | **Yes** — when conducting structured interviews |
| EIC owns it? | **No** — shared model; EIC uses default weights |
| Platform-wide? | **Yes** |
| Retroactive? | **N/A** — new capability |
| Future experts inherit? | **Yes** — with interview-type parameterization |

### Reasoning

Confidence dimensions (story, goals, reader, market, success, ambiguity, grounding) apply to any author dialogue regardless of conducting expert. Numeric scores remain operator-facing until calibration validates author display.

### Isolation rejected because

Expert-specific confidence models would produce incompatible understanding records and break unified editorial understanding contract.

---

## 3. Conversational Advancement Quality Gate

**Capability ID:** `cap.conversational_advancement_quality_gate`  
**Classification:** `platform_wide`  
**Propagation decision:** `move_to_platform`

### Description

Deterministic pass/fail gate before response emission. Fail codes include `INSUFFICIENT_EDITORIAL_ADVANCEMENT`, `INVENTED_FACT`, `EXCESSIVE_PRAISE`, `THERAPY_LANGUAGE`, etc.

### Seven propagation questions

| Question | Answer |
|----------|--------|
| Remain unique to one expert? | **No** |
| Similar experts receive it? | **Yes** |
| Every expert receive it? | **Yes** |
| EIC owns it? | **No** — enforcement is platform infrastructure |
| Platform-wide? | **Yes** |
| Retroactive? | **N/A** |
| Future experts inherit? | **Yes** — mandatory for any conversational surface |

### Reasoning

Without a shared gate, provider-assisted expert interviews could emit echo responses that pass CI Type B rules but fail Amendment 002. Central gate ensures testable conformance.

### Safety review

Gate runs before emit; failed responses never reach author. Fallback templates are deterministic.

---

## 4. Grounded Synthesis

**Capability ID:** `cap.grounded_synthesis`  
**Classification:** `platform_wide`  
**Propagation decision:** `move_to_platform`

### Description

Level 3 editorial synthesis: connect author-provided ideas into useful editorial understanding without inventing facts. Includes grounding validator tracing claims to author turns.

### Seven propagation questions

| Question | Answer |
|----------|--------|
| Remain unique to one expert? | **No** — Literary Agent pitch interviews need synthesis too |
| Similar experts receive it? | **Yes** |
| Every expert receive it? | **Yes** — when interview produces understanding artifacts |
| EIC owns it? | **No** |
| Platform-wide? | **Yes** |
| Retroactive? | **Later** |
| Future experts inherit? | **Yes** — with domain-specific synthesis templates |

### Reasoning

Synthesis rules (connect ideas, state editorial implication, no invention) are domain-agnostic. Domain-specific *content* lives in templates; *rules* are platform-wide.

### Cost review

Deterministic templates first; provider synthesis optional and capped.

---

## 5. EIC Understanding Summary

**Capability ID:** `cap.eic_understanding_summary`  
**Classification:** `editor_in_chief_owned`  
**Propagation decision:** `move_to_editor_in_chief`

### Description

EIC-composed confirmation summary presented before independent read. Includes field-by-field synthesis using Amendment 002 Level 3 where confidence ≥ adequate.

### Seven propagation questions

| Question | Answer |
|----------|--------|
| Remain unique to one expert? | **Yes** — EIC-specific confirmation copy and independent-read gate |
| Similar experts receive it? | **No** — other experts have different post-confirmation actions |
| Every expert receive it? | **No** |
| EIC owns it? | **Yes** |
| Platform-wide? | **No** |
| Retroactive? | **N/A** |
| Future experts inherit? | **No** — experts compose domain-specific summaries under their own reviews |

### Reasoning

The confirmation summary template ("Before I read your manuscript…") is EIC-specific orchestration. Literary Agent confirmation would summarize pitch readiness, not independent-read focus. Isolation is correct.

### Isolation reason

Post-confirmation action differs by conductor: EIC → independent read; Literary Agent → submission readiness; Character Expert → arc analysis. Summary composition is orchestration-owned.

---

## 6. Author Confirmation

**Capability ID:** `cap.editorial_understanding_confirmation`  
**Classification:** `platform_wide`  
**Propagation decision:** `move_to_platform`

### Description

Author must confirm or correct EIC/expert understanding before downstream action. Versioned snapshots preserved. Extends CI author confirmation gate with Amendment 002 synthesis requirements.

### Seven propagation questions

| Question | Answer |
|----------|--------|
| Remain unique to one expert? | **No** |
| Similar experts receive it? | **Yes** |
| Every expert receive it? | **Yes** — when interview produces binding understanding |
| EIC owns it? | **No** — pattern is reusable |
| Platform-wide? | **Yes** |
| Retroactive? | **Extends** `cap.conversational_intelligence` sub-capability |
| Future experts inherit? | **Yes** |

### Reasoning

Author confirmation is a constitutional author-right (§12). The *pattern* (summarize → confirm → proceed) is platform-wide; the *downstream action* varies by consumer.

### Relationship

Supersedes no prior registry entry. Extends conversational intelligence author confirmation gate with Amendment 002 quality requirements for summary content.

---

## 7. Adaptive Clarification

**Capability ID:** `cap.adaptive_clarification`  
**Classification:** `platform_wide`  
**Propagation decision:** `move_to_platform`

### Description

Material-clarification decision rules: Level 4 permitted only when ambiguity affects editorial strategy, genre, reader experience, market, success criteria, expert recommendations, or roadmap. Max one per stage.

### Seven propagation questions

| Question | Answer |
|----------|--------|
| Remain unique to one expert? | **No** |
| Similar experts receive it? | **Yes** — materiality matrix parameterized per interview |
| Every expert receive it? | **Yes** |
| EIC owns it? | **No** |
| Platform-wide? | **Yes** |
| Retroactive? | **Extends** CI Type C rules |
| Future experts inherit? | **Yes** |

### Reasoning

Clarification discipline prevents interrogation loops across all conversational surfaces. Materiality criteria are shared; stage-specific thresholds vary by interview script.

---

## 8. Encouraging-but-Honest Conversational Standard

**Capability ID:** `cap.encouraging_honest_conversational_standard`  
**Classification:** `editorial_board_shared`  
**Propagation decision:** `propagate_to_editorial_board`

### Description

Voice standard: professionally encouraging, grounded, concise, honest about uncertainty. Forbids empty praise, flattery, therapy language, robotic phrasing. EIC sets baseline; experts inherit when conducting interviews.

### Seven propagation questions

| Question | Answer |
|----------|--------|
| Remain unique to one expert? | **No** |
| Similar experts receive it? | **Yes** — all finding-producing experts |
| Every expert receive it? | **Yes** — when expert voice speaks to author in conversation |
| EIC owns it? | **No** — EIC exemplifies but does not own voice standard |
| Platform-wide? | **No** — expert interviews may add domain tone within bounds |
| Retroactive? | **Later** — apply when expert conversational UI ships |
| Future experts inherit? | **Yes** — as editorial board shared standard |

### Reasoning

Voice standard applies to any expert speaking conversationally to an author, not to platform infrastructure (flags, gates, persistence). `editorial_board_shared` is correct: experts must sound like professionals, not chatbots, but may add domain flavor (military expert directness vs literary agent commercial framing).

### Not platform-wide because

Platform infrastructure (quality gate, confidence model) does not have a "voice." Voice belongs to conversational agents — EIC and experts.

---

## Registry Entries

All eight capabilities recorded in [CAPABILITY_REGISTRY.json](./CAPABILITY_REGISTRY.json) with `constitutional_review_status: "proposed_amendment_002"`.

---

## Backlog Items

See [CAPABILITY_PROPAGATION_BACKLOG.md](./CAPABILITY_PROPAGATION_BACKLOG.md) entries B-014 through B-021.

---

## Author Experience Impact

When implemented, authors will receive:

- Richer EIC responses that demonstrate understanding rather than echo;
- Honest uncertainty statements when appropriate;
- Confirmation summaries with editorial synthesis;
- No change to author ownership, evidence boundaries, or expert recruitment order.

Authors must be informed when provider-assisted synthesis is enabled (cost, confidence implications) per Amendment 001 author authority rules.

---

## Review Sign-Off

| Field | Value |
|-------|-------|
| Reviewed by | StoryDNA Governance |
| Review date | 2026-08-01 |
| Amendment status | PROPOSED FOR RATIFICATION |
| Runtime implementation | Blocked until Amendment 002 ratified |
