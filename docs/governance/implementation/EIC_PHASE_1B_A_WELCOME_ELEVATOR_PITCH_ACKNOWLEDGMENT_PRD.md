# Feature PRD — EIC Phase 1B-a: Welcome, Elevator Pitch & EIC Acknowledgment

## Summary

- **Feature name:** EIC Phase 1B-a — Conversational intake (Stages 1–3)
- **Owner:** Kevin Track / StoryDNA Editorial Organization
- **Target phase:** Phase 1B-a (first implementation slice of conversational intake)
- **Constitution baseline:** v1.0 + Amendment 001 (RATIFIED)
- **Source blueprint:** [EIC_CONVERSATIONAL_INTAKE_AND_TEAM_APPROVAL_UX_BLUEPRINT.md](./EIC_CONVERSATIONAL_INTAKE_AND_TEAM_APPROVAL_UX_BLUEPRINT.md)
- **Scope:** Stages 1–3 only. No independent read, vision alignment, expert recommendation, permission, or approval in this phase.

---

## Constitution Compliance

```json
{
  "applicable_sections": ["§0", "§1", "§10", "§12", "§13", "§14"],
  "compliance_explanation": "Phase 1B-a implements the first constitutional step of §1 Author Intent — author-originated goals captured in the author's own words before EIC orchestration. §0 Editorial Mission requires the EIC to understand author goals; this phase collects that understanding conversationally without recruiting experts. §10 EIC governance: acknowledgment copy establishes independent-read boundary without producing expert judgments. §12 author rights: author owns the brief, may save draft, cancel, or supersede. §13 burden of proof: brief is explicitly not manuscript evidence. §14 conformance tests defined in test plan. Amendment 001 capability reviews completed below.",
  "amendment_required": "No",
  "backward_compatibility_impact": "Additive. Phase 1A Author Intent form and entry gate remain when STUDIO_EIC_CONVERSATIONAL_INTAKE is off. Submitted briefs may later derive storydna_author_intent@v1 records in Phase 1B-b; Phase 1A records are never overwritten.",
  "certification_impact": "No expert commercially enabled. No provider calls. No manuscript sharing."
}
```

---

## Capability Propagation Review

```json
{
  "new_capability_introduced": "Author manuscript brief intake (storydna_author_manuscript_brief@v1)",
  "existing_capability_modified": "Phase 1A Author Intent form UI (future replacement path)",
  "classification": "platform_wide",
  "existing_experts_evaluated": ["literary_agent", "military_expert", "developmental_editor", "editor_in_chief"],
  "future_experts_affected": ["continuity_expert", "line_editor", "character_expert"],
  "editor_in_chief_impact": "EIC acknowledgment stage establishes orchestration boundary; no expert recruitment in 1B-a.",
  "platform_impact": "New conversational Studio route, new brief persistence contract, new entry path when flag enabled.",
  "certification_impact": "No commercial enablement. Brief is author configuration, not expert output.",
  "propagation_decision": "move_to_platform",
  "review_artifact_path": "docs/governance/implementation/EIC_PHASE_1B_A_WELCOME_ELEVATOR_PITCH_ACKNOWLEDGMENT_PRD.md"
}
```

### Sub-capability classifications (reviewed)

| Capability | Classification | Propagation decision |
|------------|----------------|---------------------|
| Conversational welcome | platform_wide | move_to_platform |
| Author elevator-pitch intake | platform_wide | move_to_platform |
| Market-position intake | platform_wide | move_to_platform |
| Desired reader-experience intake | platform_wide | move_to_platform |
| Success-definition intake | platform_wide | move_to_platform |
| EIC acknowledgment | editor_in_chief_owned | move_to_editor_in_chief |
| Framing/evidence separation | platform_wide | move_to_platform |

**Framing/evidence separation rationale:** Platform-wide rule enforced in brief contract, UI copy, and future expert-context injection policies. Author brief may inform EIC planning but is never a manuscript locator or retained finding.

---

## 1. Problem statement

The Phase 1A Author Intent page behaves like a configuration form — intent enums, priority domains, and expert checklists before anyone has read the manuscript. Authors experience this as self-assembling an editorial team, which violates the constitutional order: **the EIC recruits; the author approves.**

Phase 1B-a delivers the first conversational slice: the author speaks to an Editor-in-Chief in their own words, saves or submits a manuscript brief, and receives acknowledgment that their description was heard — without expert selection, provider calls, or manuscript sharing.

---

## 2. User stories

| As an… | I want to… | So that… |
|--------|-----------|----------|
| Author | Be welcomed by the EIC in a publishing-house tone | I feel I'm hiring an editorial organization, not configuring software |
| Author | Describe my manuscript in my own words | My goals are captured before anyone reads the text |
| Author | Skip optional questions | I'm not blocked by fields I don't know yet |
| Author | Save a draft and return later | I can complete the conversation on my schedule |
| Author | Hear that my description was heard and will inform — not control — the EIC's read | I trust independent professional judgment is preserved |
| Author | Know no expert has my manuscript yet | I retain control before sharing |
| Operator | Persist briefs immutably with supersession | History and provenance are auditable |
| Operator | Keep Phase 1A working when the new flag is off | Backward compatibility is preserved |

---

## 3. Author journey (Stages 1–3)

```
Entry (Library / Book Workspace / Expert Desk redirect)
        │
        ▼
Stage 1 — Welcome
  EIC introduces; author clicks Continue
        │
        ▼
Stage 2 — Elevator pitch (6 prompts, one at a time)
  Author answers → Save draft (any step) OR Continue through all prompts
        │
        ▼
Stage 2 complete — Review summary (optional inline confirm)
        │
        ▼
Stage 3 — EIC acknowledgment
  Brief status → submitted; EIC thanks author; boundary copy shown
        │
        ▼
[Phase 1B-b] Independent read (out of scope for 1B-a)
```

**Phase 1B-a terminus:** Author sees acknowledgment screen. No Stage 4+ UI. Primary action on acknowledgment is disabled or shows "Coming in next phase" — not a workflow launch.

---

## 4. Exact interface copy

### Stage 1 — Welcome

**Page title (browser):** Your Editor-in-Chief · {book_title}

**EIC message:**

> Welcome. I'm your Editor-in-Chief at StoryDNA.
>
> Before I read your manuscript, I'd like to hear about it in your own words.
>
> Tell me what you're trying to accomplish — not what you think an editor wants to hear. I'll use your description to understand your goals, but I'll still read the manuscript fresh and form my own professional view of what's on the page.
>
> When you're ready, we'll talk through your project together.

**Primary button:** Continue

**Secondary link:** Return to Book Workspace

**Absent from screen:** Expert lists, intent dropdowns, domain chips, checklists, schema labels.

---

### Stage 2 — Elevator pitch (one prompt per screen)

**Progress label:** Step {n} of 6

**Prompt 1 — About the manuscript** *(required)*

> In a few sentences, what is this manuscript about?

Placeholder: *A few sentences is fine.*

**Prompt 2 — Why you wrote it** *(required)*

> Why did you write this book? What made it worth your time?

**Prompt 3 — Reader experience** *(optional)*

> What experience do you want readers to have — emotionally, intellectually, or viscerally?
>
> *Optional — you can skip this if you prefer.*

**Skip link:** Skip this question

**Prompt 4 — Market position** *(required; "unsure" allowed)*

> Where do you see this manuscript in the market? Who is it for?

Helper: *If you're not sure yet, say "unsure" — that's useful too.*

**Prompt 5 — Comparison titles** *(optional)*

> Are there any comparison titles or authors you have in mind?
>
> *Optional*

**Skip link:** Skip this question

**Prompt 6 — Success definition** *(required)*

> What would success look like for you at this stage — query-ready, self-publishing launch, specialist realism pass, or something else?

**Navigation (all prompt screens):**

- **Back** — previous prompt (preserves answers)
- **Save draft & exit** — persists draft; returns to Book Workspace
- **Continue** — next prompt (disabled if required field empty)

**Final prompt primary action:** Submit to Editor-in-Chief

---

### Stage 3 — EIC acknowledgment

**EIC message:**

> Thank you. That's helpful context.
>
> I've heard what you're trying to accomplish. Next, I'll read your manuscript — fresh, as if encountering it for the first time — while keeping what you've told me in mind.
>
> Your description helps me understand your goals. It does **not** override my independent professional judgment, and it is **not** treated as evidence about what's on the page.
>
> No expert has received your manuscript. When I'm ready to recommend an editorial team, I'll ask for your permission first.

**Status line:**

> Manuscript brief received · {version_label} · No experts contacted

**Primary button (Phase 1B-a):** Return to Book Workspace

**Secondary link:** Edit my answers *(reopens draft from submitted brief — creates superseding draft)*

**Absent:** Expert recommendation, permission question, launch buttons.

---

### Error states

| Condition | Copy |
|-----------|------|
| Required field empty | Please answer in your own words before continuing. |
| Save failed | We couldn't save your draft. Please try again. |
| Submit failed | We couldn't submit your brief. Your answers are preserved — try again. |
| Version mismatch | Your manuscript version changed. Please review your answers for this version. |
| Not owner | Only the author who started this brief may edit it. |
| No manuscript version | This book has no active manuscript version. Upload a version first. |

---

### Empty states

| Condition | Copy |
|-----------|------|
| Resuming draft | Welcome back. Let's pick up where you left off. |
| No draft, first visit | *(Stage 1 welcome)* |
| Flag off | *(Fall through to Phase 1A form or legacy path — see backward compatibility)* |

---

## 5. Data contract

**Contract version:** `storydna_author_manuscript_brief@v1`

```json
{
  "contract_version": "storydna_author_manuscript_brief@v1",
  "brief_id": "uuid",
  "book_id": "uuid",
  "manuscript_id": "uuid",
  "manuscript_version_id": "uuid",
  "elevator_pitch": "string",
  "author_motivation": "string",
  "desired_reader_experience": "string | null",
  "market_position": "string",
  "comparison_titles": "string | null",
  "success_definition": "string",
  "status": "draft | submitted | superseded | cancelled",
  "created_by": "string",
  "created_at": "timestamp",
  "updated_at": "timestamp",
  "submitted_at": "timestamp | null",
  "supersedes_brief_id": "uuid | null",
  "superseded_at": "timestamp | null"
}
```

### Field rules

| Field | Required | Notes |
|-------|----------|-------|
| elevator_pitch | Yes | Min 10 characters trimmed |
| author_motivation | Yes | Min 10 characters trimmed |
| desired_reader_experience | No | Null if skipped |
| market_position | Yes | Literal `"unsure"` is valid |
| comparison_titles | No | Null if skipped |
| success_definition | Yes | Min 5 characters trimmed |

### Status transitions

```
draft → submitted (author submits at end of Stage 2)
draft → cancelled (author abandons)
submitted → superseded (new brief submitted for same version)
submitted → (immutable — no edit in place)
```

---

## 6. Persistence model

**Recommended table:** `author_manuscript_briefs` (migration in implementation phase — not in this PRD task)

- One active `draft` per `(manuscript_id, manuscript_version_id, created_by)` at a time.
- One active `submitted` brief per `(manuscript_id, manuscript_version_id)` at a time (partial unique index).
- Submitted rows are immutable; edits create new draft linked via `supersedes_brief_id`.
- On submit, prior `submitted` row for same version → `superseded` with `superseded_at`.

**Relationship to Phase 1A:**

- Phase 1B-a does **not** auto-create `author_intent_records` on submit.
- Derivation mapping to `storydna_author_intent@v1` is Phase 1B-b scope.
- Entry gate (`entry-gate.ts`) continues to check Phase 1A active intent until brief-derived intent ships.

---

## 7. Draft-save behavior

- **Save draft & exit** available on every Stage 2 prompt.
- Persists all answers entered so far with `status: draft`.
- Returns author to Book Workspace with toast: "Draft saved."
- Resuming: if draft exists for current version, Stage 2 opens at first unanswered required prompt (or last visited step if all answered).
- Draft does not trigger EIC acknowledgment (Stage 3).
- Draft does not satisfy Phase 1A entry gate.

---

## 8. Validation rules

1. `elevator_pitch`, `author_motivation`, `success_definition` required on submit.
2. `market_position` required; `"unsure"` is explicit valid value.
3. Optional fields may be null.
4. `manuscript_version_id` must match book's current version at submit.
5. `created_by` must match session author on all mutations.
6. Cannot submit draft belonging to another author.
7. Cannot transition `submitted` → `draft` (create superseding draft instead).
8. Unknown expert keys must not appear in brief (no expert fields in 1B-a).
9. Brief text must not be logged with manuscript `extracted_text` in same log line.

---

## 9. Privacy and ownership

- **Author owns the brief** — only `created_by` may save, submit, or supersede.
- Brief content is author-provided framing, not shared with experts in 1B-a.
- Brief is not written to expert workflow tables.
- Brief is not injected into provider prompts in 1B-a.
- Server logs must redact or omit brief body in production info logs.
- Studio access gate (`requireStudioAccess`) applies to all routes.

---

## 10. Framing-versus-evidence boundary

| Property | Author manuscript brief | Manuscript evidence |
|----------|------------------------|---------------------|
| Source | Author conversation | Authoritative manuscript version text |
| Used as expert finding | Never | Yes (with locators) |
| Overrides EIC judgment | No — informs only | N/A |
| Shown to experts in 1B-a | No | No (experts not engaged) |
| UI label | "What you told me" | *(not shown in 1B-a)* |

**Acknowledgment copy (Stage 3) must display:** brief is not treated as evidence about what's on the page.

**Implementation guard:** Brief contract must carry `is_manuscript_evidence: false` in metadata (computed, not author-editable).

---

## 11. Feature flags

| Flag | Default | Production | Purpose |
|------|---------|------------|---------|
| `STUDIO_EIC_CONVERSATIONAL_INTAKE` | off | unavailable | Master gate for Stages 1–3 UI |
| `STUDIO_AUTHOR_INTENT_ENABLED` | off | unavailable | Must remain on for Kevin Track intent path (existing) |
| `STUDIO_EIC_ENABLED` | off | unavailable | Must remain on for EIC features (existing) |

**Activation rule for 1B-a UI:**

```
STUDIO_EIC_CONVERSATIONAL_INTAKE=1
AND STUDIO_AUTHOR_INTENT_ENABLED=1
AND STUDIO_EIC_ENABLED=1
AND NODE_ENV !== 'production'
```

When conversational intake flag is off, `/studio/books/[bookId]/intent` renders Phase 1A form (current behavior).

---

## 12. Backward compatibility

| Asset | Phase 1B-a behavior |
|-------|---------------------|
| Phase 1A Author Intent form | Shown when `STUDIO_EIC_CONVERSATIONAL_INTAKE` off |
| Phase 1A entry gate redirect | Unchanged; still checks `author_intent_records` |
| Expert Desk | Unchanged; no brief requirement in 1B-a |
| Historical reports | Untouched |
| Literary Agent / Military Expert workflows | Unchanged |
| StoryDNA-derived AuthorIntent | Unchanged |

---

## 13. Migration implications

**Not in this design task.** Implementation phase will add:

- Migration `0033_author_manuscript_briefs.sql` (proposed number)
- Table `author_manuscript_briefs` matching contract
- Partial unique indexes for one draft and one submitted per version
- Composite FK `(manuscript_version_id, manuscript_id)`

Additive only. No alteration to Phase 1A tables.

---

## 14. Accessibility

- Keyboard: Tab order = question → textarea → Back → Save draft → Continue.
- EIC messages: `role="article"` + `aria-label="Editor-in-Chief"`.
- Progress: `aria-valuenow` / `aria-valuemax` on step indicator.
- Required fields: `aria-required="true"` + visible label (not placeholder-only).
- Skip links: keyboard-accessible; announce "Question skipped" to screen readers.
- Focus management: on prompt change, focus moves to textarea.
- Minimum touch target 44×44px on tablet.
- Color contrast WCAG AA for EIC message panel.

---

## 15. Desktop and tablet behavior

| Breakpoint | Layout |
|------------|--------|
| Desktop (≥1024px) | Centered conversation column, max-width 640px |
| Tablet (768–1023px) | Full-width with 24px horizontal padding; sticky footer with Continue |
| Mobile (<768px) | Out of scope; show existing Studio desktop/tablet notice if needed |

One question per screen on all breakpoints. No side-by-side expert panels.

---

## 16. Tests

### Unit tests (`lib/author-manuscript-brief/`)

1. Required elevator pitch — reject empty/whitespace
2. Optional reader experience — accept null on skip
3. Market position — accept `"unsure"`
4. Draft save — creates/updates draft row
5. Submit brief — transitions draft → submitted
6. Supersession — new submit supersedes prior submitted
7. Author ownership — reject mutation by non-creator
8. Version mismatch — reject submit when version changed
9. Brief not evidence — contract metadata flag false
10. No provider import — source scan of brief service module

### Integration tests (Studio actions)

11. Flags off — conversational route not rendered; Phase 1A form shown
12. Flags on — Stages 1–3 render; no expert checklist in HTML
13. Save draft & exit — returns to workspace; draft persisted
14. Submit — Stage 3 acknowledgment displayed

### Gate tests

15. Submitted brief does **not** satisfy Phase 1A entry gate (until 1B-b derivation)
16. No workflow launch from brief submit action

### Accessibility smoke

17. All Stage 2 prompts have associated labels
18. Step progress exposes accessible name

### Governance

19. `npm run governance:capability-check` on this PRD

---

## 17. Acceptance criteria

1. Author sees EIC welcome with required opening line before any form fields.
2. Stage 2 collects six conversational prompts with no expert UI.
3. Author may save draft and resume.
4. Author may skip optional prompts 3 and 5.
5. Market position accepts `"unsure"`.
6. Submit creates immutable `submitted` brief.
7. Stage 3 acknowledgment displays all constitutional boundary copy.
8. Status line confirms no experts contacted.
9. No provider call in 1B-a code paths.
10. No expert workflow launch in 1B-a code paths.
11. Flags off preserves Phase 1A behavior.
12. Governance capability-check passes on this PRD.

---

## 18. Risks

| Risk | Mitigation |
|------|------------|
| Authors expect full flow through team approval | Acknowledgment sets expectation; "Return to Book Workspace" only in 1B-a |
| Brief confused with Author Intent record | Separate contract; derivation deferred to 1B-b |
| Entry gate still blocks Expert Desk after brief submit | Documented; 1B-a does not replace intent gate |
| Conversation feels slow | Save draft; progress indicator |
| Provider accidentally called in implementation | PRD forbids; test source scan; no read phase in 1B-a |

---

## 19. Implementation sequence

| Step | Deliverable | Depends on |
|------|-------------|------------|
| 1 | `storydna_author_manuscript_brief@v1` types + validation | PRD approved |
| 2 | Migration `0033_author_manuscript_briefs.sql` | Step 1 |
| 3 | Brief service (create draft, save, submit, supersede) | Step 2 |
| 4 | Feature flag `STUDIO_EIC_CONVERSATIONAL_INTAKE` | — |
| 5 | Replace `AuthorIntentClient` with conversational Stages 1–3 when flag on | Steps 3–4 |
| 6 | Server actions for draft save and submit | Step 3 |
| 7 | Focused tests (Section 16) | Steps 1–6 |
| 8 | `.env.example` update for new flag | Step 4 |

**Explicitly out of scope for 1B-a implementation:**

- Stage 4 independent read (provider call)
- Vision alignment
- Expert recommendation
- Permission and approval gates
- Derivation to `storydna_author_intent@v1`

---

## Rollout / certification gates

- Private Studio only (`STUDIO_EIC_CONVERSATIONAL_INTAKE`).
- Defaults off; production unavailable.
- No expert commercially enabled.
- Phase 1B-b PRD required before independent read or intent derivation.
