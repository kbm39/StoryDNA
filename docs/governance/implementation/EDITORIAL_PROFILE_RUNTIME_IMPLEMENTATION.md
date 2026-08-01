# Editorial Profile Runtime Implementation

**Contracts:** `storydna_editorial_profile@v1`, `storydna_eic_independent_read@v1`  
**Location:** `lib/editorial-profile/`, `lib/eic-independent-read/`

## Constitution Compliance

```json
{
  "applicable_sections": ["§0", "§1", "§6", "§8", "§10", "§12", "§13", "§14", "Amendment 001", "Amendment 002"],
  "compliance_explanation": "EP-1 foundation plus EP-2 synthesis implement EIC-owned editorial profile contract and deterministic candidate creation from independent read without enabling experts, granting manuscript access, or substituting author intent for manuscript evidence.",
  "amendment_required": "No",
  "backward_compatibility_impact": "Additive lib modules; flags default off.",
  "certification_impact": "No commercial enablement. Profile synthesis remains EIC orchestration only."
}
```

## Capability Propagation Review

```json
{
  "new_capability_introduced": "Editorial Profile candidate synthesis from independent read (EP-2)",
  "existing_capability_modified": "cap.editorial_profile — runtime types (EP-1) now wired to independent read output",
  "classification": "editor_in_chief_owned",
  "existing_experts_evaluated": ["literary_agent", "military_expert", "developmental_editor", "editor_in_chief"],
  "future_experts_affected": ["line_editor", "character_expert", "continuity_expert", "timeline_expert"],
  "editor_in_chief_impact": "Primary owner. EIC synthesizes profile candidates after independent read; no specialist access at synthesis.",
  "platform_impact": "lib/editorial-profile/candidate-from-independent-read.ts, lib/eic-independent-read/",
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

### EP-2 (this slice)

| Delivered | Deferred |
|-----------|----------|
| `storydna_eic_independent_read@v1` input contract | Persistence + migration (EP-3) |
| Deterministic profile candidate synthesis entry point | Provider/model synthesis |
| Independent read gate validation (complete, identity, grounded evidence) | Roadmap Stage 1 wiring (EP-4) |
| Bounded EIC synthesis input (framing vs evidence separation) | Author dispute UI (EP-5) |
| All 10 profile sections mapped from read observations | Expert context injection (EP-6) |
| Non-active terminal statuses only (`draft`, `incomplete_evidence`, `awaiting_eic_confirmation`, `failed`) | Profile activation |

## Orchestration entry point

**File:** `lib/editorial-profile/candidate-from-independent-read.ts`

**Function:** `createEditorialProfileCandidateFromIndependentRead(input)`

Flow:

1. Gate on `STUDIO_EDITORIAL_PROFILE_ENABLED` (+ EIC + Author Intent prerequisites)
2. Validate independent read: `complete`, manuscript/version match, grounded L1 evidence, zero specialist access
3. Validate author intent + confirmed editorial understanding scope (framing only)
4. Build bounded synthesis input (`buildBoundedSynthesisInput`)
5. Deterministically map read observations → all 10 profile sections
6. Preserve evidence provenance, conflicts, alignment notes, uncertainty
7. Run `validateForDraft` / `detectProhibitedInputs` / `computeAggregateConfidence`
8. Resolve terminal status: `awaiting_eic_confirmation` (activation-ready), `incomplete_evidence`, or `failed`
9. Never activate, grant sharing, launch specialists, or generate roadmap

## Author control boundaries

- EIC owns profile synthesis after independent read
- Author Intent + Editorial Understanding inform alignment only (L5–L7 framing)
- Authors may review/dispute but never author profile fields
- Profile activation does **not** grant specialist manuscript access
- Sharing requires separate author approval (roadmap Stage 7 + consent gate)

## Feature flag

```
STUDIO_EDITORIAL_PROFILE_ENABLED=0   # default off, dev-only
```

Requires `STUDIO_EIC_ENABLED=1` and `STUDIO_AUTHOR_INTENT_ENABLED=1`. Unavailable in production.

## Module map

| File | Responsibility |
|------|----------------|
| `lib/editorial-profile/contract.ts` | Version, statuses, vocabularies, thresholds |
| `lib/editorial-profile/types.ts` | `EditorialProfileV1` and section block types |
| `lib/editorial-profile/lifecycle.ts` | Valid/invalid status transitions, activation guards |
| `lib/editorial-profile/validation.ts` | Structural, draft, activation validation |
| `lib/editorial-profile/versioning.ts` | Supersession, immutability, alignment-only patches |
| `lib/editorial-profile/feature-flag.ts` | `STUDIO_EDITORIAL_PROFILE_ENABLED` gate |
| `lib/editorial-profile/candidate-from-independent-read.ts` | EP-2 synthesis orchestration |
| `lib/eic-independent-read/contract.ts` | Independent read contract version + statuses |
| `lib/eic-independent-read/types.ts` | `EicIndependentReadV1` input artifact |

## Tests

```bash
# EP-1 foundation (31 tests)
node --import ./scripts/test-path-alias.mjs --experimental-strip-types --test lib/editorial-profile/editorial-profile.test.ts

# EP-2 synthesis (25 tests)
node --import ./scripts/test-path-alias.mjs --experimental-strip-types --test lib/editorial-profile/candidate-from-independent-read.test.ts
```

## Governance traceability

- Framework: [STORYDNA_EDITORIAL_PROFILE_FRAMEWORK.md](./STORYDNA_EDITORIAL_PROFILE_FRAMEWORK.md)
- PRD: [STORYDNA_EDITORIAL_PROFILE_PRD.md](./STORYDNA_EDITORIAL_PROFILE_PRD.md)
- Registry: `cap.editorial_profile` in [CAPABILITY_REGISTRY.json](../capabilities/CAPABILITY_REGISTRY.json)
