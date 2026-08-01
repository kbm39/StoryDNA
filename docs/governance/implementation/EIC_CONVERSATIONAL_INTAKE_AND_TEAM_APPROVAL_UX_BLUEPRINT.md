# EIC Conversational Intake & Editorial Team Approval — UX Blueprint

**Document type:** Design and UX blueprint (no runtime implementation)  
**Owner:** Kevin Track / StoryDNA Editorial Organization  
**Branch baseline:** `feature/eic-phase-1a-author-intent`  
**Constitution baseline:** v1.0 + Amendment 001 (RATIFIED)  
**Supersedes UX for:** Phase 1A configuration-form Author Intent page (future phase, not retroactive)

---

## 1. Plain-English product vision

StoryDNA Kevin Track should feel like hiring a publishing house, not configuring software.

Today, the Phase 1A Author Intent page asks the author to self-assemble an editorial team — choosing intent enums, priority domains, and expert checklists before anyone has read the manuscript. That inverts the constitutional order: the **Editor-in-Chief recruits**; the **author approves**.

This blueprint replaces the configuration-form experience with a **conversational intake** led by the Editor-in-Chief. The author speaks in their own words. The EIC listens, reads independently, compares vision to execution, recommends specialists with reasons, and asks permission before any expert receives the manuscript. The author may add, remove, defer, or decline experts. **No expert workflow launches until final editorial-team approval is persisted.**

The EIC recommends. The author decides. Experts inform. Manuscript evidence remains supreme.

---

## 2. Constitution Compliance

```json
{
  "applicable_sections": ["§0", "§1", "§6", "§8", "§10", "§12", "§13", "§14"],
  "compliance_explanation": "The conversational intake preserves §1 Author Intent as author-originated configuration derived from natural language, not expert judgment. §0 and §10 require the EIC to understand goals and recruit the correct team — this design assigns recruitment to the EIC and approval to the author. §6 expert governance is preserved: no expert receives the manuscript before permission; tripartite authority unchanged. §8 report hierarchy remains intact — this blueprint affects pre-recruitment UX only. §12 author rights (select/decline experts, define intent, reject recommendations) are explicit at every stage. §13 burden of proof: author pitch is not manuscript evidence; expert findings still require locators. §14 conformance tests are defined in Section 19.",
  "amendment_required": "No",
  "backward_compatibility_impact": "Additive UX phase atop Phase 1A records. Existing storydna_author_intent@v1 and storydna_eic_editorial_plan@v1 records remain valid. Phase 1A configuration-form UI is replaced in a future implementation phase; historical intent records and reports are preserved.",
  "certification_impact": "No expert commercially enabled by this blueprint. Permission and approval gates strengthen certification boundaries."
}
```

---

## 3. Capability Propagation Review

```json
{
  "new_capability_introduced": "EIC conversational intake and editorial team approval (storydna_eic_conversational_intake@v1)",
  "existing_capability_modified": "Phase 1A Author Intent form UI; storydna_author_intent@v1 record derivation path",
  "classification": "platform_wide",
  "existing_experts_evaluated": ["literary_agent", "military_expert", "developmental_editor", "editor_in_chief"],
  "future_experts_affected": ["continuity_expert", "timeline_expert", "archivist", "combat_medicine_expert", "line_editor", "character_expert"],
  "editor_in_chief_impact": "EIC becomes the visible orchestrator of intake, independent read planning, vision-alignment assessment, and expert recommendation before any specialist runs.",
  "platform_impact": "New conversational Studio flow, new contracts for vision alignment and team approval, new gates before manuscript sharing and workflow launch.",
  "certification_impact": "Permission and final-approval gates reinforce that no uncertified expert receives manuscript access without explicit author consent.",
  "propagation_decision": "move_to_platform",
  "review_artifact_path": "docs/governance/implementation/EIC_CONVERSATIONAL_INTAKE_AND_TEAM_APPROVAL_UX_BLUEPRINT.md"
}
```

### 3.1 Sub-capability reviews (completed)

| # | Capability | Proposed | Final classification | Propagation decision | Rationale |
|---|------------|----------|---------------------|----------------------|-----------|
| 1 | Author elevator-pitch intake | platform_wide | **platform_wide** | move_to_platform | Author-facing intake is a platform author experience; all experts consume derived intent |
| 2 | Independent first-read separation | editor_in_chief_owned | **editor_in_chief_owned** | move_to_editor_in_chief | Orchestration boundary; EIC-owned planning layer; not expert judgment |
| 3 | Author-vision vs manuscript-alignment assessment | editor_in_chief_owned | **editor_in_chief_owned** | move_to_editor_in_chief | EIC-derived assessment; must not impersonate specialist findings |
| 4 | EIC expert recommendation with reasons | editor_in_chief_owned | **editor_in_chief_owned** | move_to_editor_in_chief | Recruitment is EIC §10 responsibility; experts are inputs only |
| 5 | Author permission before manuscript sharing | platform_wide | **platform_wide** | move_to_platform | Cross-cutting author-rights gate affecting all workflows and experts |
| 6 | Author addition/removal of experts | platform_wide | **platform_wide** | move_to_platform | Author control (§12) is platform-wide; extends Phase 1A intent fields |
| 7 | Final editorial-team approval gate | editor_in_chief_owned | **editor_in_chief_owned** | move_to_editor_in_chief | EIC plan confirmation before Editorial Board activation; orchestration only |

**Retrospective expert assessments (Amendment 001):**

| Expert | Applicable | Reason |
|--------|------------|--------|
| literary_agent | later | Receives manuscript only post-approval; unchanged runtime |
| military_expert | later | Same; experimental status preserved |
| developmental_editor | later | Planned; shown as unavailable in recommendations |
| editor_in_chief | yes | Primary owner of intake orchestration layer |

---

## 4. Complete author journey

```
Library / Book Workspace
        │
        ▼
[Stage 1] EIC Welcome ───────────────────────── conversational, no expert UI
        │
        ▼
[Stage 2] Elevator pitch ────────────────────── author words only
        │
        ▼
[Stage 3] EIC acknowledgment ──────────────── thanks + independent-read promise
        │
        ▼
[Stage 4] Independent read (EIC planning) ───── manuscript read boundary; no expert access
        │
        ▼
[Stage 5] Vision alignment presentation ─────── EIC compares vision vs execution
        │
        ▼
[Stage 6] Recommended editorial team ────────── experts + reasons + honest availability
        │
        ▼
[Stage 7] Permission gate ───────────────────── "May I share your manuscript?"
        │
        ▼
[Stage 8] Additional experts (optional) ─────── author may add/defer/remove
        │
        ▼
[Stage 9] Final approval ────────────────────── "Approve Editorial Team"
        │
        ▼
Expert Desk (recruitment complete; launch still author-confirmed per expert)
```

**Invariant:** At no point before Stage 9 completion may any expert workflow start or any provider receive manuscript text for expert execution.

---

## 5. Exact interface copy

### Stage 1 — Welcome

**EIC (Editor-in-Chief):**

> Welcome. I'm your Editor-in-Chief at StoryDNA.
>
> Before I read your manuscript, I'd like to hear about it in your own words.
>
> Tell me what you're trying to accomplish — not what you think an editor wants to hear. I'll use your description to understand your goals, but I'll still read the manuscript fresh and form my own professional view of what's on the page.
>
> When you're ready, we'll talk through your project together.

**Primary action:** Continue

**Secondary action:** Return to Book Workspace

---

### Stage 2 — Elevator pitch (conversational prompts)

The interface presents **one question at a time** in chat-like panels. No expert checklists. No intent enum dropdown on first pass.

**Prompt 1 — About the manuscript**

> In a few sentences, what is this manuscript about?

**Prompt 2 — Why you wrote it**

> Why did you write this book? What made it worth your time?

**Prompt 3 — Reader experience (optional skip)**

> What experience do you want readers to have — emotionally, intellectually, or viscerally?
>
> *(Optional — skip if you prefer)*

**Prompt 4 — Market position**

> Where do you see this manuscript in the market? Who is it for?

**Prompt 5 — Comparison titles (optional skip)**

> Are there any comparison titles or authors you have in mind?
>
> *(Optional)*

**Prompt 6 — Success definition**

> What would success look like for you at this stage — query-ready, self-publishing launch, specialist realism pass, or something else?

**Primary action:** Continue to review

**Secondary action:** Save draft & exit

---

### Stage 3 — EIC acknowledgment

**EIC:**

> Thank you. That's helpful context.
>
> I'm going to read your manuscript now — fresh, as if encountering it for the first time — while keeping what you've told me in mind.
>
> Your description helps me understand your goals. It does **not** override my independent professional judgment, and it is **not** treated as evidence about what's on the page.
>
> After I've read it, I'll share how your stated vision compares with what I see in the execution, and I'll recommend the editorial team I believe will serve this project best.

**System status line:**

> Reading manuscript · Version {version_label} · No experts have been contacted

**Primary action:** Continue *(disabled until EIC read phase completes in implementation)*

---

### Stage 4 — Independent read (status copy)

**EIC (during read — async state):**

> I'm reading your manuscript now. This usually takes a few minutes depending on length.

**EIC (read complete — transition to Stage 5):**

> I've finished my first read. Let me share what I found.

---

### Stage 5 — Vision alignment

**Section header:** Your vision and what's on the page

**Subsection — Your stated vision (author-provided, labeled):**

> *From your conversation:* {elevator_pitch_summary}

**Subsection — My independent assessment (EIC, labeled):**

> *From my read of the manuscript:* {independent_assessment_summary}

**Alignment badge:** {Strongly aligned | Substantially aligned | Partially aligned | Materially misaligned}

**EIC explanation:**

> {alignment_explanation}

**Market position assessment:**

> {market_position_assessment}

**Unresolved questions (if any):**

> Before I recommend specialists, I want to flag a few questions:
> - {question_1}
> - {question_2}

**Primary action:** Show me your recommended team

---

### Stage 6 — Recommended editorial team

**Section header:** Recommended editorial team

**EIC intro:**

> Based on your goals and my read of the manuscript, this is the team I'd recommend.

**Per-expert card template:**

```
{Expert display name}
{Availability badge} · {Certification badge}

Why I'm recommending this expert:
{recommendation_reason}

What this expert will answer:
{expert_questions}

Estimated runtime: {runtime_range}
Estimated cost: {cost_range}
Role: {Required | Recommended | Optional | Experimental | Unavailable — planned}
```

**Footer disclosure:**

> Unavailable experts are shown for transparency only. StoryDNA will not present a planned expert as ready to work.

**Primary action:** Continue to permission

---

### Stage 7 — Permission

**EIC (required question):**

> This is the editorial team I recommend. May I share your manuscript with these experts?

**Author actions (buttons):**

- **Approve recommended team**
- **Remove an expert** *(opens expert picker with remove flow)*
- **Ask why** *(expands recommendation reason for selected expert)*
- **Defer an expert** *(moves expert to deferred list; not shared this round)*
- **Decline team** *(returns to goals conversation; does not launch)*
- **Return to goals** *(Stage 2, preserving prior answers as draft)*

**Hard rule copy (persistent footer):**

> No expert will receive your manuscript until you approve sharing. StoryDNA does not launch expert reviews automatically.

---

### Stage 8 — Additional experts

**EIC (required question):**

> Are there any other StoryDNA experts you would like to read the manuscript?

**Organization (tabs or accordion — NOT request/decline columns):**

1. **Recommended team** — experts EIC already proposed; toggle include/defer
2. **Optional specialists** — EIC-suggested optional coverage
3. **Experimental specialists** — honest experimental labeling; private Studio only
4. **Currently unavailable** — visible but not selectable; explanation shown

**Per unavailable expert:**

> {Expert name} is not yet available in StoryDNA. I can note your interest for when this specialist is certified.

**Primary action:** Continue to final review

---

### Stage 9 — Final approval

**Section header:** Final editorial team approval

**Summary table:**

| Expert | Purpose | Runtime | Cost |
|--------|---------|---------|------|
| {name} | {purpose} | {runtime} | {cost} |

**Metadata block:**

- Manuscript version: {version_label}
- Author intent (derived): {intent_summary}
- Status: **No expert has started**

**EIC:**

> This is your approved editorial team. Once you confirm, I'll prepare recruitment — but no expert review will begin until you explicitly launch each expert from the Expert Desk.

**Required final action button:**

> **Approve Editorial Team**

**Secondary actions:**

- Edit team (return to Stage 8)
- Return to goals

---

## 6. Screen-by-screen wireframe descriptions

### Screen A — Welcome (Stage 1)

- **Layout:** Single-column conversational panel, max-width 640px, centered.
- **Header:** "Editor-in-Chief" label with StoryDNA editorial mark; no expert avatars.
- **Body:** EIC message bubble (left-aligned, serif accent for EIC name).
- **Footer:** Primary "Continue" button; subtle link to Book Workspace.
- **Absent:** Intent dropdowns, domain chips, expert checklists.

### Screen B — Elevator pitch (Stage 2)

- **Layout:** Chat thread — EIC question bubble, author textarea reply, progress indicator (Step 2 of 6).
- **Input:** Large textarea, 3–6 rows; character guidance "A few sentences is fine."
- **Navigation:** Back (previous question), Continue (next question), Skip (optional prompts only).
- **Absent:** Side panels, expert lists, priority domain buttons.

### Screen C — Acknowledgment (Stage 3)

- **Layout:** EIC message + manuscript metadata card (title, version, word count).
- **Status pill:** "Reading manuscript" with spinner during Stage 4.
- **Absent:** Any expert recruitment UI.

### Screen D — Vision alignment (Stage 5)

- **Layout:** Two-column on desktop (author vision | EIC assessment); stacked on tablet.
- **Alignment badge:** Color-coded but accessible (icon + text, not color-only).
- **Collapsible:** Unresolved questions accordion.

### Screen E — Recommended team (Stage 6)

- **Layout:** Vertical stack of expert cards; required experts pinned top.
- **Card anatomy:** Name, badges, reason, questions, cost/runtime, role chip.
- **Unavailable experts:** Grayed card, "Planned" badge, no launch affordance.

### Screen F — Permission (Stage 7)

- **Layout:** EIC question prominent; action button group below.
- **Remove flow:** Inline modal — select expert, confirm remove with reason optional.
- **Defer flow:** Moves expert to "Deferred" section with restore option.

### Screen G — Additional experts (Stage 8)

- **Layout:** Tabbed or accordion sections per organization rule.
- **Interaction:** Toggle add/defer per expert; unavailable section read-only.
- **Absent:** Separate "Request" and "Decline" columns.

### Screen H — Final approval (Stage 9)

- **Layout:** Summary table + metadata + single primary approval button.
- **Confirmation:** Post-approval toast — "Editorial team approved. No expert has started."

---

## 7. State transitions

```
                    ┌─────────────┐
                    │   welcome   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ pitch_draft │◄────────────────┐
                    └──────┬──────┘                 │
                           │                        │ return_to_goals
                    ┌──────▼──────┐                 │
                    │ pitch_complete│───────────────┘
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ acknowledged │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ eic_reading  │ (async)
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ vision_review│
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ team_recommended│
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼──────┐ ┌───▼───┐ ┌──────▼──────┐
       │  declined   │ │defer/ │ │  permission │
       │  (exit)     │ │remove │ │  granted    │
       └─────────────┘ └───┬───┘ └──────┬──────┘
                             │            │
                      ┌──────▼──────┐     │
                      │ add_experts │◄────┘
                      └──────┬──────┘
                             │
                      ┌──────▼──────┐
                      │ final_review │
                      └──────┬──────┘
                             │
                      ┌──────▼──────┐
                      │ team_approved│ ──► Expert Desk (launch gated separately)
                      └─────────────┘
```

**Persistence checkpoints:**

| State | Persisted artifact |
|-------|------------------|
| pitch_complete | `storydna_author_elevator_pitch@v1` draft |
| acknowledged | Author Intent draft derived from pitch |
| vision_review | `storydna_eic_vision_alignment@v1` |
| team_recommended | `storydna_eic_editorial_plan@v1` (status: awaiting_author_confirmation) |
| permission granted | sharing permission record |
| team_approved | plan status: confirmed; team approval gate open for Expert Desk |

---

## 8. Data requirements

### New contracts (design only — not implemented)

| Contract | Purpose |
|----------|---------|
| `storydna_author_elevator_pitch@v1` | Raw conversational intake |
| `storydna_eic_independent_read@v1` | EIC first-read planning metadata (not expert findings) |
| `storydna_eic_vision_alignment@v1` | Vision vs execution assessment |
| `storydna_eic_team_sharing_permission@v1` | Author permission before manuscript sharing |
| `storydna_eic_editorial_team_approval@v1` | Final approved team snapshot |

### Mapping to Phase 1A records

| Conversational field | Maps to `storydna_author_intent@v1` |
|---------------------|--------------------------------------|
| Success definition | `author_success_definition` |
| Market position + comps | `intent_type` (derived by EIC, author confirms) |
| Elevator pitch body | `custom_objective_text` or structured pitch JSON |
| Added/deferred experts | `requested_experts`, declined/deferred lists |
| Final approved team | EIC plan `confirmed` status |

**Rule:** Phase 1A records remain the persistence layer; conversational intake is a **derivation path**, not a replacement schema in Phase 1B design.

---

## 9. Independent-read boundary

### Architectural separation

```
┌─────────────────────────────────────────────────────────┐
│  AUTHOR ELEVATOR PITCH (author-provided framing)        │
│  - Stored separately                                    │
│  - Label: "Author stated vision"                        │
│  - NOT manuscript evidence                              │
│  - NOT passed to experts as ground truth                │
└───────────────────────┬─────────────────────────────────┘
                        │ informs (read-only context)
                        ▼
┌─────────────────────────────────────────────────────────┐
│  EIC INDEPENDENT READ PLANE (editor_in_chief_owned)     │
│  - Reads authoritative manuscript version               │
│  - Produces vision-alignment assessment only            │
│  - Does NOT produce retained expert findings            │
│  - Does NOT impersonate Literary Agent / specialists    │
└───────────────────────┬─────────────────────────────────┘
                        │ after author approval only
                        ▼
┌─────────────────────────────────────────────────────────┐
│  EXPERT EXECUTION PLANE (expert workflows)              │
│  - Manuscript shared only post-permission               │
│  - Experts produce immutable findings                   │
│  - Author pitch may appear as optional context label    │
│    but never overrides manuscript locators              │
└─────────────────────────────────────────────────────────┘
```

### Hard rules

1. Author pitch **informs** EIC planning; it **does not control** independent judgment.
2. Author pitch is **not** manuscript evidence (§13).
3. Providers performing EIC independent read must **not** merely restate the elevator pitch as assessment.
4. No expert receives manuscript bytes before Stage 7 permission (Stage 9 for workflow launch).
5. EIC assessment is **orchestration metadata**, not a Unified Finding.

---

## 10. Vision-alignment contract

**Contract:** `storydna_eic_vision_alignment@v1`

```json
{
  "contract_version": "storydna_eic_vision_alignment@v1",
  "manuscript_id": "uuid",
  "manuscript_version_id": "uuid",
  "author_elevator_pitch_id": "uuid",
  "author_stated_vision_summary": "string",
  "independent_assessment_summary": "string",
  "alignment_level": "strongly_aligned | substantially_aligned | partially_aligned | materially_misaligned",
  "alignment_explanation": "string",
  "market_position_assessment": "string",
  "unresolved_questions": ["string"],
  "created_at": "timestamp",
  "created_by": "editor_in_chief"
}
```

**Alignment level definitions:**

| Level | Meaning |
|-------|---------|
| Strongly aligned | Execution clearly delivers stated vision and market position |
| Substantially aligned | Core vision present; gaps are refinements not reconceptions |
| Partially aligned | Significant gap between stated goals and on-page execution |
| Materially misaligned | Stated vision and manuscript appear to describe different projects |

---

## 11. Expert-recommendation contract

**Extends:** `storydna_eic_editorial_plan@v1`

Each `ExpertPlanEntry` gains conversational fields:

```json
{
  "expert_key": "string",
  "display_name": "string",
  "tier": "required | recommended | optional | experimental | unavailable | deferred | removed_by_author",
  "recommendation_reason": "string",
  "questions_expert_will_answer": ["string"],
  "estimated_runtime_range": "string | null",
  "estimated_cost_range": "string | null",
  "availability_status": "available | experimental | unavailable | planned",
  "certification_status": "certified | not_certified | planned",
  "launchable": false
}
```

**EIC rules:**

- Never present unavailable expert as launchable.
- Experimental experts labeled honestly.
- Required vs recommended distinction is EIC judgment; author may demote to deferred.

---

## 12. Permission and approval contracts

### Sharing permission — `storydna_eic_team_sharing_permission@v1`

```json
{
  "contract_version": "storydna_eic_team_sharing_permission@v1",
  "manuscript_id": "uuid",
  "manuscript_version_id": "uuid",
  "author_intent_id": "uuid",
  "permitted_expert_keys": ["string"],
  "deferred_expert_keys": ["string"],
  "declined_expert_keys": ["string"],
  "permission_granted_at": "timestamp | null",
  "permission_granted_by": "author_id"
}
```

### Final approval — `storydna_eic_editorial_team_approval@v1`

```json
{
  "contract_version": "storydna_eic_editorial_team_approval@v1",
  "manuscript_id": "uuid",
  "manuscript_version_id": "uuid",
  "eic_plan_id": "uuid",
  "approved_expert_keys": ["string"],
  "approved_at": "timestamp",
  "approved_by": "author_id",
  "manuscript_version_at_approval": "uuid",
  "no_expert_started_confirmed": true
}
```

**Gate rule:** Expert Desk launch actions check `approved_at` and version match before any workflow row creation.

---

## 13. Failure and empty states

| State | Copy | Action |
|-------|------|--------|
| No manuscript text | "This manuscript has no readable text yet. Upload a version before editorial intake." | Link to upload |
| EIC read failed | "I wasn't able to complete my first read. Your goals are saved — try again when ready." | Retry |
| No experts recommended | "Based on your goals, I don't have certified specialists to recommend yet. We can revisit when additional experts are available." | Return to goals |
| Author declines team | "Understood. Your goals are saved. Return whenever you'd like to revisit the editorial team." | Book Workspace |
| Version changed mid-flow | "Your manuscript version changed since we started. Let's confirm your goals still apply to this version." | Reconfirm or restart |
| Flags off | Fall through to Phase 1A form or legacy Expert Desk per existing flags | Legacy path |

---

## 14. Accessibility requirements

- All conversational steps keyboard-navigable (Tab order: question → input → primary action).
- EIC messages announced to screen readers as `role="article"` with `aria-label="Editor-in-Chief"`.
- Alignment badges use icon + text label (WCAG 1.4.1).
- Expert cards expose availability and certification in visible text, not color alone.
- Focus trap in remove/defer modals; Escape closes.
- Minimum touch target 44×44px on tablet for approval buttons.
- Live region announces async read completion.

---

## 15. Desktop and tablet behavior

| Breakpoint | Behavior |
|------------|----------|
| Desktop (≥1024px) | Single-column conversation max 640px; vision alignment two-column |
| Tablet (768–1023px) | Full-width conversation; stacked vision columns; expert cards full width |
| Mobile (<768px) | Out of scope for Kevin Track Phase 1B; show "Studio best on tablet or desktop" |

Sticky footer on tablet: primary action always visible during pitch and approval stages.

---

## 16. Cost and runtime disclosure

- Display ranges, never exact list prices unless certified catalog provides them.
- Prefix with "Estimated" on every cost/runtime line.
- Aggregate footer on final approval: "Total estimated runtime: {range} · Total estimated cost: {range}".
- Experimental experts: "Cost varies · local testing only."
- Unavailable experts: no cost/runtime shown.

---

## 17. Backward compatibility

| Asset | Treatment |
|-------|-----------|
| Phase 1A `author_intent_records` | Preserved; conversational intake derives compatible records |
| Phase 1A `eic_editorial_plans` | Extended contract fields additive |
| Phase 1A entry gate redirect | Remains; conversational flow replaces form at `/intent` |
| Legacy Expert Desk | Accessible after team approval; per-expert launch still separate |
| Historical reports | Untouched |
| StoryDNA-derived AuthorIntent prompt | Legacy bridge unchanged |
| Flags off | Phase 1A form or legacy paths per existing behavior |

---

## 18. Migration implications

**Design phase — no migrations in this task.**

Future implementation may require:

1. `author_elevator_pitches` table (or JSONB on intent record).
2. `eic_vision_alignments` table.
3. `eic_team_sharing_permissions` table.
4. `eic_editorial_team_approvals` table.
5. Additive columns on `eic_editorial_plans` for approval status linkage.

All migrations must be additive; Phase 1A rows never overwritten.

---

## 19. Test plan

### Constitutional conformance (§14)

1. Author control — author can decline, defer, remove, return to goals at every stage.
2. Author Intent — derived from conversation, explicitly author-originated.
3. Evidence-first — pitch not treated as manuscript evidence in tests.
4. Expert independence — no expert artifact created during intake.
5. Immutable history — pitch and approval snapshots append-only.
6. Provenance — every recommendation cites EIC reason string.
7. Certification gates — unavailable experts never launchable in tests.
8. Unified experience — one EIC voice, not per-expert intake forms.
9. Backward compatibility — Phase 1A records readable after conversational intake ships.

### UX tests

1. No expert checklist visible in Stages 1–3.
2. Permission question exact match required copy.
3. Additional experts uses four sections, not request/decline columns.
4. Final approval blocked until permission granted.
5. Expert Desk launch blocked until team approval persisted.
6. Active intent from Phase 1A form still honored until superseded by conversational record.

### Governance tests

- `npm run governance:capability-check` on this document.

---

## 20. Acceptance criteria

1. Author experiences EIC-led conversation before any expert recruitment UI.
2. Elevator pitch collected in author's own words without initial expert selection burden.
3. EIC acknowledges independent read with correct constitutional copy.
4. Vision alignment shows both author vision and independent assessment with alignment level.
5. Expert recommendations include reason, questions, cost/runtime, honest availability.
6. Permission gate uses exact required question copy.
7. Additional experts organized per product rules (no request/decline columns).
8. Final approval persists before Expert Desk launch becomes available.
9. No provider call or expert workflow in intake flow design.
10. Phase 1A historical records and reports preserved.

---

## 21. Implementation phases

| Phase | Scope | Depends on |
|-------|-------|------------|
| **1B-a** | Conversational UI shell (Stages 1–3); pitch persistence | Phase 1A flags |
| **1B-b** | EIC independent read + vision alignment presentation | 1B-a |
| **1B-c** | Team recommendation cards (Stage 6); deterministic then model-assisted | 1B-b |
| **1B-d** | Permission + additional experts (Stages 7–8) | 1B-c |
| **1B-e** | Final approval gate + Expert Desk integration | 1B-d |
| **1B-f** | Replace configuration-form Author Intent page | 1B-e |

Each phase requires its own Capability Propagation Review update and PRD before runtime work.

---

## 22. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| EIC independent read impersonates Literary Agent | Strict contract boundary; no retained findings; labeled orchestration metadata |
| Author pitch leaks as expert ground truth | Separate storage; experts receive optional context label only |
| Conversation feels slow vs form | Progress indicator; save draft; async read with status |
| Authors bypass permission gate | Server-side gate on manuscript share and workflow create |
| Planned experts shown as available | Unavailable tier enforced in recommendation contract + UI tests |
| Phase 1A form users disrupted | Feature flag `STUDIO_EIC_CONVERSATIONAL_INTAKE`; form fallback until 1B-f |

---

## Appendix A — Current Phase 1A elements to replace (future)

| Element | Location | Replacement |
|---------|----------|-------------|
| Intent type dropdown (first screen) | `AuthorIntentClient.tsx` | Conversational derivation in Stage 2 |
| Priority domain chip grid | `AuthorIntentClient.tsx` | EIC infers; author confirms in vision stage |
| Request/decline expert checklists | `AuthorIntentClient.tsx` | Stages 7–8 permission and additional experts |
| Immediate EIC plan preview on activate | `author-intent.ts` actions | After Stage 5–6 only |
| "Activate intent" without conversation | `AuthorIntentClient.tsx` | Stage 9 "Approve Editorial Team" |

**Preserve from Phase 1A:**

- `storydna_author_intent@v1` record shape
- Entry gate redirect logic (`entry-gate.ts`)
- Immutable history and supersession
- Expert Desk post-approval (with new approval gate)

---

## Appendix B — Product rules checklist

- [x] EIC recommends; author approves
- [x] Experts do not receive manuscript before permission
- [x] Author may add, remove, defer, decline experts
- [x] Author pitch informs but does not control independent judgment
- [x] Author pitch is not manuscript evidence
- [x] No provider or workflow launches in this design task
- [x] Phase 1A records and reports preserved
