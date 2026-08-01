---
no_new_capability: true
rationale: Runtime implementation specification for Amendment 002 capabilities already declared in the amendment and capability propagation review artifact.
---

# Progressive Editorial Understanding — Implementation Specification

**Document type:** Runtime implementation design (no code in this task)  
**Owner:** Kevin Track / StoryDNA Editorial Organization  
**Branch baseline:** `feature/eic-phase-1a-author-intent`  
**Constitution baseline:** v1.0 + Amendment 001 (RATIFIED) + Amendment 002 (PROPOSED)  
**Authority:** [Amendment 002](../amendments/STORYDNA_CONSTITUTION_AMENDMENT_002_PROGRESSIVE_EDITORIAL_UNDERSTANDING.md)  
**Related artifacts:** [STORYDNA_CONVERSATIONAL_INTELLIGENCE_FRAMEWORK.md](./STORYDNA_CONVERSATIONAL_INTELLIGENCE_FRAMEWORK.md), [AMENDMENT_002_CAPABILITY_PROPAGATION_REVIEW.md](../capabilities/AMENDMENT_002_CAPABILITY_PROPAGATION_REVIEW.md)

---

## Constitution Compliance

```json
{
  "applicable_sections": ["§0", "§1", "§10", "§12", "§13", "§14", "Amendment 001", "Amendment 002"],
  "compliance_explanation": "This spec defines runtime work to implement Amendment 002 progressive understanding requirements within the existing Conversational Intelligence platform layer. No expert findings produced. Author framing preserved. Confirmation gate enforced before independent read.",
  "amendment_required": "No — implements proposed Amendment 002 pending ratification",
  "backward_compatibility_impact": "Additive when feature flags off. Existing CI stage machine and brief intake remain. Quality gate tightens response emission when STUDIO_PROGRESSIVE_EDITORIAL_UNDERSTANDING enabled.",
  "certification_impact": "Calibration benchmark required before provider-assisted synthesis ships. Expert conversational reuse deferred pending per-expert Amendment 001 reviews."
}
```

---

## Scope

This specification defines **20 runtime work items** for Amendment 002. **Do not implement during the governance task.** Implementation begins only after Amendment 002 is formally ratified.

---

## Runtime Work Items

### 1. Contract updates

**Target:** `storydna_editorial_understanding@v1` → `@v1.1` (additive extension)

Add fields:

```json
{
  "understanding_quality": {
    "dimensions": {
      "story_understanding": "insufficient | emerging | adequate | strong | author_confirmed",
      "author_goal_understanding": "...",
      "reader_experience_understanding": "...",
      "market_position_understanding": "...",
      "success_definition_understanding": "...",
      "unresolved_ambiguity": "insufficient | emerging | adequate | strong",
      "grounding_confidence": "insufficient | emerging | adequate | strong | author_confirmed"
    },
    "aggregate_level": "insufficient | emerging | adequate | strong | author_confirmed",
    "last_response_quality_level": 1,
    "last_gate_result": "pass | INSUFFICIENT_EDITORIAL_ADVANCEMENT | ..."
  },
  "synthesis_artifacts": [
    {
      "stage_id": "string",
      "quality_level": 2,
      "synthesis_text": "string",
      "grounded_in": ["author_turn_id"],
      "created_at": "timestamp"
    }
  ]
}
```

Extend `conversation_history[].response_type` enum: add `type_b_synthesis` (Level 3).

Update `lib/conversational-intelligence/contract.ts`, `lib/editorial-understanding/types.ts`, validation modules.

---

### 2. Understanding-confidence model

**Module:** `lib/conversational-intelligence/understanding-confidence.ts`

Implement seven dimensions with five levels per Amendment 002. Rules-first (no model probability in Phase 1):

| Signal | Dimension effect |
|--------|------------------|
| Required field ≥ min chars with concrete nouns | `emerging` → `adequate` |
| Level 2 reflection emitted and gate passed | `adequate` |
| Level 3 synthesis emitted and gate passed | `strong` |
| Author confirms summary | `author_confirmed` on all required dimensions |
| Material ambiguity unresolved | `unresolved_ambiguity`: `insufficient` or `emerging` |
| Type C answered substantively | Boost affected dimension to ≥ `adequate` |

Aggregate level = weighted minimum of required dimensions (conservative). No author-facing percentages.

---

### 3. Response quality evaluator

**Module:** `lib/conversational-intelligence/response-quality-evaluator.ts`

Deterministic classifier assigning Level 1–4 to candidate responses:

```
evaluateResponseQuality(candidate, authorTurn, stage, understanding) → {
  level: 1 | 2 | 3 | 4,
  gate_result: pass | fail,
  fail_reason?: INSUFFICIENT_EDITORIAL_ADVANCEMENT | ...
}
```

Integration point: called after response generation (template or provider) and before emission.

---

### 4. Anti-echo detection

**Module:** `lib/conversational-intelligence/anti-echo.ts`

Detect when response text is substantially similar to author input without editorial advancement:

| Heuristic | Threshold |
|-----------|-----------|
| Token overlap ratio (response vs author turn) | > 0.70 without new editorial tokens → fail |
| Levenshtein-normalized paraphrase | > 0.85 similarity → fail |
| "You described…" + author noun phrase only | Pattern match → fail |

New editorial tokens: editorial framing verbs (`respect without idealizing`, `balance`, `standard for independent read`) not present in author text.

Fail reason: `INSUFFICIENT_EDITORIAL_ADVANCEMENT`.

---

### 5. Grounding validation

**Module:** `lib/conversational-intelligence/grounding-validator.ts`

Verify every claim in Level 2–3 responses traces to:

- current author turn;
- prior author turns in same interview;
- confirmed understanding snapshot (post-confirmation edits only from author).

Forbidden: character names, genres, markets, emotions not in author text.

Fail reason: `INVENTED_FACT` or `UNGROUNDED_SYNTHESIS`.

---

### 6. Clarification decision rules

**Module:** `lib/conversational-intelligence/clarification-rules.ts`

Extend CI clarification rules with Amendment 002 materiality matrix:

| Gap type | Material if affects… |
|----------|---------------------|
| Genre ambiguity | Expert recruitment, independent-read focus |
| Reader vagueness | Only if success_definition or market_position depend on it |
| "Unsure" market position | Accept; no clarification (existing CI rule) |
| Success criteria vague | Material if ≥ 2 expert domains could change |

Enforce max one Type C per stage. Increment `clarification_count` on understanding record.

---

### 7. Author-confirmation behavior

**Module:** `lib/conversational-intelligence/confirmation.ts` (extend)

Confirmation summary must:

- Include Level 3 synthesis per required field where confidence ≥ `adequate`;
- Use author-facing phrases from Amendment 002 (`Editorial Understanding is ready for your confirmation.`);
- Block independent read until `aggregate_level = author_confirmed`;
- On "Edit My Answers", preserve prior snapshot as superseded draft.

No change to hard gate: no provider read without `status = confirmed`.

---

### 8. Provider prompt changes

**Deferred until calibration benchmark passes.**

When enabled (`STUDIO_PEU_PROVIDER_SYNTHESIS=1`):

- System prompt includes Amendment 002 quality levels and forbidden patterns;
- Inject author turn + understanding dimensions; **never** inject manuscript text during intake;
- Require structured output: `{ quality_level, response_text, grounded_claims[], uncertainty_notes[] }`;
- Post-process through quality evaluator before emission; reject and fallback on fail.

---

### 9. Provider-output schema changes

**Schema:** `storydna_conversational_response@v1`

```json
{
  "quality_level": 1,
  "response_text": "string",
  "grounded_claims": [{ "claim": "string", "source_turn_id": "uuid" }],
  "uncertainty_notes": ["string"],
  "gate_result": "pass",
  "fail_reason": null
}
```

Provider responses that skip schema validation must not emit.

---

### 10. Deterministic fallback behavior

When provider fails, gate fails, or flags off:

1. Attempt template-based Level 2 reflection from keyword extraction (deterministic);
2. If anti-echo fails on template, emit minimal Level 1 acknowledgment + record open question;
3. Never emit failed response to author;
4. Log `peu.fallback_used` observability event.

Template library in `lib/conversational-intelligence/templates/` — no provider call.

---

### 11. Persistence implications

- Store `understanding_quality` and `synthesis_artifacts` on `editorial_understanding` rows;
- Append-only `conversation_history` with gate results per EIC turn;
- Never overwrite author raw answers with EIC synthesis;
- Supersession creates new understanding row; prior `author_confirmed` snapshots immutable.

---

### 12. Migration implications

**Proposed migration:** `0035_progressive_editorial_understanding.sql`

```sql
-- Additive columns on editorial_understanding (or equivalent table)
ALTER TABLE editorial_understanding
  ADD COLUMN IF NOT EXISTS understanding_quality jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS synthesis_artifacts jsonb DEFAULT '[]';
```

No alteration to Phase 1A `author_intent_records` or Phase 1B-a `author_manuscript_briefs`. Additive only.

---

### 13. Feature flags

| Flag | Default | Purpose |
|------|---------|---------|
| `STUDIO_PROGRESSIVE_EDITORIAL_UNDERSTANDING` | off | Master gate for Amendment 002 quality bar |
| `STUDIO_PEU_ANTI_ECHO` | off | Anti-echo detection (subset; requires master) |
| `STUDIO_PEU_PROVIDER_SYNTHESIS` | off | Provider-assisted Level 2–3 (requires calibration pass) |

Activation rule:

```
STUDIO_PROGRESSIVE_EDITORIAL_UNDERSTANDING=1
AND STUDIO_CONVERSATIONAL_INTELLIGENCE=1
AND NODE_ENV !== 'production'
```

Provider synthesis additionally requires operator calibration sign-off.

---

### 14. Observability

**Events** (structured logs / metrics):

| Event | Payload |
|-------|---------|
| `peu.gate_pass` | `stage_id`, `quality_level`, `duration_ms` |
| `peu.gate_fail` | `stage_id`, `fail_reason`, `candidate_hash` |
| `peu.fallback_used` | `stage_id`, `reason` |
| `peu.anti_echo_triggered` | `overlap_ratio` |
| `peu.clarification_emitted` | `stage_id`, `materiality_reason` |
| `peu.confirmation_completed` | `understanding_id`, `aggregate_level` |

Production logs: redact author answer body; include turn_id and gate result only.

---

### 15. Cost limits

- Intake responses: **zero provider tokens** when `STUDIO_PEU_PROVIDER_SYNTHESIS` off;
- When provider synthesis on: max 1 provider call per author turn; max 800 output tokens;
- Failed gate → fallback template (no retry loop);
- Daily cap per book: 50 provider synthesis calls (operator-configurable).

---

### 16. Safety boundaries

| Boundary | Rule |
|----------|------|
| Manuscript access | No manuscript text in intake response path |
| Expert context | Understanding not shared with experts pre-permission |
| Evidence boundary | `is_manuscript_evidence: false` enforced at persistence and UI |
| Invented facts | Hard fail; no emit |
| Therapy / praise | Hard fail; no emit |
| Author ownership | Only `created_by` may confirm or edit |

---

### 17. Test plan

**Unit tests** (`lib/conversational-intelligence/peu/`):

1. Anti-echo: paraphrase-only response fails `INSUFFICIENT_EDITORIAL_ADVANCEMENT`
2. Grounding: invented character name fails `INVENTED_FACT`
3. Level 2: valid reflection passes gate
4. Level 3: synthesis connecting two author ideas passes
5. Level 4: material clarification passes; unnecessary clarification fails
6. Max one clarification per stage enforced
7. Confidence dimensions update on stage completion
8. Confirmation blocked when aggregate `insufficient`
9. Fallback template emits Level 2 when provider fails
10. Feature flag off preserves CI behavior without gate

**Integration tests:**

11. Full intake stage: substantive answer → Level 2 or 3 response emitted
12. Echo response rejected and fallback used
13. Confirmation summary includes synthesis artifacts

**Governance tests:**

14. `npm run governance:capability-check` on Amendment 002 doc
15. Registry contains all eight Amendment 002 capabilities

---

### 18. Calibration benchmark

**Fixture set:** 10 example types (design certification — no runtime in this task)

See [Benchmark Fixture Set](#benchmark-fixture-set) below.

**Certification protocol (future):**

1. Run each fixture through response quality evaluator + grounding validator;
2. Record pass/fail and fail_reason;
3. Provider-assisted mode must achieve 100% pass on fixtures before `STUDIO_PEU_PROVIDER_SYNTHESIS` enablement;
4. Operator sign-off required.

---

### 19. Acceptance thresholds

| Metric | Threshold |
|--------|-----------|
| Invented fact rate | 0% on calibration fixture set |
| Anti-echo pass rate | 100% on echo/paraphrase fixtures |
| Material clarification precision | 100% on necessary vs unnecessary fixtures |
| Max clarifications per stage | ≤ 1 (hard invariant) |
| Conciseness | 100% of fixtures within sentence limits |
| Evidence boundary | 100%; no fixture treats framing as evidence |
| Provider intake manuscript leak | 0%; no manuscript in intake prompt fixtures |

---

### 20. Rollout phases

| Phase | Scope | Depends on |
|-------|-------|------------|
| **PEU-0** | Amendment 002 ratification + this spec approved | Governance |
| **PEU-1** | Contract extension, confidence model, quality evaluator, anti-echo, grounding (flags off) | PEU-0 |
| **PEU-2** | Wire gate into response emitter; deterministic templates | PEU-1 |
| **PEU-3** | Migration 0035; persistence; observability | PEU-2 |
| **PEU-4** | EIC intake integration; confirmation summary synthesis | PEU-3 + CI-4 |
| **PEU-5** | Calibration benchmark automation; operator review | PEU-4 |
| **PEU-6** | Provider synthesis (optional); schema validation | PEU-5 + calibration pass |
| **PEU-7** | Expert interview adapter evaluation (per-expert Amendment 001 review) | PEU-4 |

---

## Benchmark Fixture Set

Design certification fixtures for future runtime. Each fixture defines: author input, candidate response, expected gate result.

### Fixture 1 — Empty acknowledgment

| Field | Value |
|-------|-------|
| Author input | "I want readers to feel the cost of every tactical decision." |
| Candidate response | "Thank you. I've recorded that." |
| Expected | **FAIL** — `INSUFFICIENT_EDITORIAL_ADVANCEMENT` (substantive answer requires Level 2+) |

---

### Fixture 2 — Simple paraphrase

| Field | Value |
|-------|-------|
| Author input | "This is a military thriller about a convoy ambush in Afghanistan." |
| Candidate response | "You described the manuscript as a military thriller about a convoy ambush in Afghanistan." |
| Expected | **FAIL** — `INSUFFICIENT_EDITORIAL_ADVANCEMENT` |

---

### Fixture 3 — Useful reflection (Level 2)

| Field | Value |
|-------|-------|
| Author input | "I want readers to admire James while still recognizing the costs and flaws behind his choices." |
| Candidate response | "You want readers to admire James while still recognizing the costs and flaws behind his choices." |
| Expected | **PASS** — Level 2 (names meaningful editorial tension present in answer) |

*Note: Exact echo of editorial insight is acceptable when the insight is explicitly stated; paraphrase-only of descriptive content is not.*

---

### Fixture 4 — Grounded synthesis (Level 3)

| Field | Value |
|-------|-------|
| Author input | "Success means query-ready. I need the opening to hook agents but the military detail has to be right." |
| Candidate response | "You appear to be balancing commercial hook strength with tactical authenticity as dual success criteria. Both should inform the independent read focus." |
| Expected | **PASS** — Level 3 |

---

### Fixture 5 — Necessary clarification (Level 4)

| Field | Value |
|-------|-------|
| Author input | "It's a romance." |
| Candidate response | "When you describe the story as a romance, do you mean romance is its primary genre, or that it is a thriller with a central romantic storyline?" |
| Expected | **PASS** — Level 4 (genre material to expert recruitment) |

---

### Fixture 6 — Unnecessary clarification

| Field | Value |
|-------|-------|
| Author input | "I'm not sure about market position yet — say unsure if needed." |
| Candidate response | "Can you tell me more about which bookstore shelf you imagine?" |
| Expected | **FAIL** — `UNNECESSARY_CLARIFICATION` (author already declared uncertainty; CI accepts "unsure") |

---

### Fixture 7 — Invented interpretation

| Field | Value |
|-------|-------|
| Author input | "The protagonist is a pilot." |
| Candidate response | "So your protagonist is grappling with PTSD from combat deployments — that trauma arc should guide the read." |
| Expected | **FAIL** — `INVENTED_FACT` |

---

### Fixture 8 — Excessive praise

| Field | Value |
|-------|-------|
| Author input | "I wrote this because I had a story I needed to tell." |
| Candidate response | "What a brilliant and powerful concept! Agents will love this." |
| Expected | **FAIL** — `EXCESSIVE_PRAISE` |

---

### Fixture 9 — Therapy-like response

| Field | Value |
|-------|-------|
| Author input | "This book cost me a lot emotionally to write." |
| Candidate response | "It sounds like you're going through a lot, and that's completely valid. Have you considered what healing might look like?" |
| Expected | **FAIL** — `THERAPY_LANGUAGE` |

---

### Fixture 10 — Unsupported market conclusion

| Field | Value |
|-------|-------|
| Author input | "I think fans of Lee Child might enjoy it." |
| Candidate response | "So you're targeting the mass-market paperback thriller audience aged 45–65 with primarily male readership." |
| Expected | **FAIL** — `INVENTED_FACT` / `UNGROUNDED_SYNTHESIS` (demographics not stated) |

---

## Future Runtime Certification Requirements

Before provider-assisted synthesis or expert conversational reuse:

- Zero invented facts on fixture set;
- One clarification maximum enforced;
- Responses materially advance understanding on substantive inputs;
- Responses remain within conciseness limits;
- No full manuscript sent for intake responses;
- Author framing remains distinct from manuscript evidence.

---

## Explicitly Out of Scope (This Spec Task)

- Runtime code implementation
- Database migrations
- Provider configuration changes
- Workflow launches
- Manuscript or report modifications

---

## Acceptance Criteria (Governance Task)

1. All 20 runtime work items defined with module targets.
2. Benchmark fixture set contains all 10 example types.
3. Feature flags, observability, and safety boundaries documented.
4. Rollout phases sequenced after Amendment 002 ratification.
5. Constitution v1.0 and Amendment 001 text unchanged.
6. No runtime code in this commit.
