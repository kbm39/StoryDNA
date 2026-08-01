# Editorial Profile Runtime Implementation

**Contracts:** `storydna_editorial_profile@v1`, `storydna_eic_independent_read@v1`  
**Location:** `lib/editorial-profile/`, `lib/eic-independent-read/`

## Constitution Compliance

```json
{
  "applicable_sections": ["§0", "§1", "§6", "§8", "§10", "§12", "§13", "§14", "Amendment 001", "Amendment 002"],
  "compliance_explanation": "EP-1 foundation, EP-2 synthesis, and EP-3 confirmation gate implement EIC-owned editorial profile contract, deterministic candidate creation, and structured activation without enabling experts, granting manuscript access, or substituting author intent for manuscript evidence.",
  "amendment_required": "No",
  "backward_compatibility_impact": "Additive lib modules; flags default off.",
  "certification_impact": "No commercial enablement. Profile synthesis and activation remain EIC orchestration only."
}
```

## Capability Propagation Review

```json
{
  "new_capability_introduced": "Editorial Profile EIC confirmation and activation gate (EP-3)",
  "existing_capability_modified": "cap.editorial_profile — candidate synthesis (EP-2) now wired to activation gate",
  "classification": "editor_in_chief_owned",
  "existing_experts_evaluated": ["literary_agent", "military_expert", "developmental_editor", "editor_in_chief"],
  "future_experts_affected": ["line_editor", "character_expert", "continuity_expert", "timeline_expert"],
  "editor_in_chief_impact": "Primary owner. EIC confirms and activates profile as authoritative version; no specialist access at activation.",
  "platform_impact": "lib/editorial-profile/confirm-and-activate.ts",
  "certification_impact": "No commercial enablement change.",
  "propagation_decision": "move_to_editor_in_chief",
  "review_artifact_path": "docs/governance/implementation/EDITORIAL_PROFILE_RUNTIME_IMPLEMENTATION.md"
}
```

## Scope by phase

### EP-1 (foundation)

| Delivered | Deferred |
|-----------|----------|
| Contract types for all 10 sections | — |
| 7-level evidence hierarchy constants | — |
| 11-state lifecycle with transition guards | — |
| Draft / activation validation | — |
| Versioning + supersession helpers | — |
| Feature flag `STUDIO_EDITORIAL_PROFILE_ENABLED` | — |

### EP-2 (candidate synthesis)

| Delivered | Deferred |
|-----------|----------|
| `storydna_eic_independent_read@v1` input contract | Persistence + migration |
| Deterministic profile candidate synthesis entry point | Provider/model synthesis |
| Independent read gate validation | Roadmap Stage 1 wiring (EP-4) |
| Bounded EIC synthesis input | Author dispute UI (EP-5) |
| All 10 profile sections mapped from read observations | Expert context injection (EP-6) |
| Non-active terminal statuses only | Profile activation |

### EP-3 (this slice — confirmation and activation gate)

| Delivered | Deferred |
|-----------|----------|
| `confirmAndActivateEditorialProfile()` orchestration | Author-facing confirmation UI (EP-5) |
| `submitEditorialProfileForEicConfirmation()` draft → awaiting | Persistence + migration |
| Structured `EditorialProfileEicConfirmationRecord` | Roadmap Stage 1 wiring (EP-4) |
| Activation-readiness via existing `validateForActivation` | Expert context injection (EP-6) |
| Lifecycle transition `awaiting_eic_confirmation` → `active` | |
| Safe supersession for same manuscript version | |
| Version-history preservation via `linkSupersededProfile` | |
| Author-control boundaries (activation ≠ consent) | |

## Orchestration entry points

### EP-2 — Candidate synthesis

**File:** `lib/editorial-profile/candidate-from-independent-read.ts`  
**Function:** `createEditorialProfileCandidateFromIndependentRead(input)`

Resolves to `awaiting_eic_confirmation`, `incomplete_evidence`, or `failed` — never `active`.

### EP-3 — EIC confirmation and activation

**File:** `lib/editorial-profile/confirm-and-activate.ts`

| Function | Transition |
|----------|------------|
| `submitEditorialProfileForEicConfirmation(input)` | `draft` → `awaiting_eic_confirmation` (when activation-ready) |
| `confirmAndActivateEditorialProfile(input)` | `awaiting_eic_confirmation` → `active` |

**Activation flow:**

1. Gate on `STUDIO_EDITORIAL_PROFILE_ENABLED`
2. Validate candidate identity (manuscript, version, provenance)
3. Confirm eligible lifecycle state (`awaiting_eic_confirmation` only)
4. Run `validateForActivation` + prohibited input detection (no weaker rules)
5. Build structured EIC confirmation record (positive-first section order)
6. On success: transition to `active`, set `activated_at`, supersede prior active for same version
7. On failure: preserve violations; return `awaiting_eic_confirmation`, `failed`, or terminal status
8. Never grant specialist access, generate roadmap, or imply author consent

## EIC confirmation record

**Type:** `EditorialProfileEicConfirmationRecord` in `lib/editorial-profile/types.ts`

Structured auditable record — not a boolean approval. Includes:

- Confirmation identity, profile/version, manuscript IDs
- Candidate and resulting lifecycle states
- EIC identity and timestamp
- Readiness result and validation findings
- Unresolved uncertainty and conflicts
- Section confirmations (positive-first order):
  1. Manuscript understanding
  2. What is working
  3. Protected Assets
  4. Improvement opportunities
  5. Editorial Risks
  6. Specialist Requirements
  7. Roadmap Inputs
  8. Activation readiness
- Evidence and provenance sufficiency
- Reason, failure info, superseded profile linkage
- Author-control boundaries (`EDITORIAL_PROFILE_ACTIVATION_BOUNDARIES`)

## Activation-readiness

Uses existing validators in `lib/editorial-profile/validation.ts`:

- `validateEditorialProfileContract(profile, "structural")`
- `validateForActivation(profile)` — same thresholds as EP-1/EP-2
- `detectProhibitedInputs(profile)`
- Provenance and evidence sufficiency checks in `confirm-and-activate.ts`

No weaker activation-only validation path.

## Lifecycle transitions supported

| From | To | Entry point |
|------|-----|-------------|
| `draft` | `awaiting_eic_confirmation` | `submitEditorialProfileForEicConfirmation` |
| `awaiting_eic_confirmation` | `active` | `confirmAndActivateEditorialProfile` |
| `awaiting_eic_confirmation` | `failed` | Prohibited input during confirmation |
| `awaiting_eic_confirmation` | (unchanged) | Activation validation failure |

**Blocked transitions:** `failed` → `active`, `blocked` → `active`, `superseded` → `active`, `draft` → `active` (direct).

Uses `validateActivationTransition` and `validateEditorialProfileStatusTransition` from `lifecycle.ts`.

## Supersession and version history

- First activation: no prior supersession
- Same `(manuscript_id, manuscript_version_id)`: prior `active` → `superseded` via `linkSupersededProfile`
- Different manuscript version: both may remain `active` — no cross-version silent overwrite
- Prior profiles preserved as immutable history with `superseded_by_profile_id` linkage

## Author control boundaries

Activation means only: profile is the current authoritative EIC understanding artifact for the manuscript version.

Activation does **not** mean:

- Author approved specialist execution
- Author approved manuscript sharing
- Author accepted recommendations, changes, grade, or roadmap
- Author surrendered final editorial authority

Constants: `EDITORIAL_PROFILE_ACTIVATION_BOUNDARIES` in `contract.ts`.

## Feature flag

```
STUDIO_EDITORIAL_PROFILE_ENABLED=0   # default off, dev-only
```

Requires `STUDIO_EIC_ENABLED=1` and `STUDIO_AUTHOR_INTENT_ENABLED=1`. Unavailable in production.

## Auditability

Confirmation record captures: candidate evaluated, validation findings, lifecycle transitions, superseded profile, EIC identity, uncertainty/conflicts, and explicit `specialist_manuscript_access_granted: false` / `roadmap_generated: false`.

No manuscript text in error messages or confirmation summaries.

## Model calls

None. EP-3 uses deterministic evaluation from structured candidate evidence.

## Persistence

No migration in EP-3. Confirmation and activation are runtime-only (in-memory). Persistence deferred to a future slice.

## Module map

| File | Responsibility |
|------|----------------|
| `lib/editorial-profile/contract.ts` | Version, statuses, activation boundaries, confirmation section order |
| `lib/editorial-profile/types.ts` | `EditorialProfileV1`, `EditorialProfileEicConfirmationRecord` |
| `lib/editorial-profile/lifecycle.ts` | Valid/invalid status transitions, activation guards |
| `lib/editorial-profile/validation.ts` | Structural, draft, activation validation |
| `lib/editorial-profile/versioning.ts` | Supersession, immutability, alignment-only patches |
| `lib/editorial-profile/feature-flag.ts` | `STUDIO_EDITORIAL_PROFILE_ENABLED` gate |
| `lib/editorial-profile/candidate-from-independent-read.ts` | EP-2 synthesis orchestration |
| `lib/editorial-profile/confirm-and-activate.ts` | EP-3 confirmation and activation gate |
| `lib/eic-independent-read/contract.ts` | Independent read contract version + statuses |
| `lib/eic-independent-read/types.ts` | `EicIndependentReadV1` input artifact |

## Tests

```bash
# EP-1 foundation (31 tests)
node --import ./scripts/test-path-alias.mjs --experimental-strip-types --test lib/editorial-profile/editorial-profile.test.ts

# EP-2 synthesis (25 tests)
node --import ./scripts/test-path-alias.mjs --experimental-strip-types --test lib/editorial-profile/candidate-from-independent-read.test.ts

# EP-3 confirmation and activation (41 tests)
node --import ./scripts/test-path-alias.mjs --experimental-strip-types --test lib/editorial-profile/confirm-and-activate.test.ts

# All editorial profile tests
node --import ./scripts/test-path-alias.mjs --experimental-strip-types --test lib/editorial-profile/*.test.ts
```

## Deferred

- Author-facing EIC confirmation screen (EP-5)
- Database persistence for confirmation records
- Roadmap Stage 1 wiring (EP-4)
- Expert context injection (EP-6)
- Provider-assisted confirmation synthesis

## Governance traceability

- Framework: [STORYDNA_EDITORIAL_PROFILE_FRAMEWORK.md](./STORYDNA_EDITORIAL_PROFILE_FRAMEWORK.md)
- PRD: [STORYDNA_EDITORIAL_PROFILE_PRD.md](./STORYDNA_EDITORIAL_PROFILE_PRD.md) — FR-07, §19, §28, §29
- Registry: `cap.editorial_profile` in [CAPABILITY_REGISTRY.json](../capabilities/CAPABILITY_REGISTRY.json)
