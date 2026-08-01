# Editorial Profile Runtime Implementation (EP-1)

**Phase:** EP-1 — contract, validation, lifecycle, versioning foundation  
**Contract:** `storydna_editorial_profile@v1`  
**Location:** `lib/editorial-profile/`

## Constitution Compliance

```json
{
  "applicable_sections": ["§0", "§1", "§6", "§8", "§10", "§12", "§13", "§14", "Amendment 001", "Amendment 002"],
  "compliance_explanation": "EP-1 runtime foundation implements EIC-owned editorial profile contract and validation without enabling experts, granting manuscript access, or substituting author intent for manuscript evidence.",
  "amendment_required": "No",
  "backward_compatibility_impact": "Additive lib module; flags default off.",
  "certification_impact": "No commercial enablement. Profile synthesis remains EIC orchestration only."
}
```

## Capability Propagation Review

```json
{
  "new_capability_introduced": "Editorial Profile runtime foundation (storydna_editorial_profile@v1 types/validation)",
  "existing_capability_modified": "cap.editorial_profile — design artifact now has runtime types",
  "classification": "editor_in_chief_owned",
  "existing_experts_evaluated": ["literary_agent", "military_expert", "developmental_editor", "editor_in_chief"],
  "future_experts_affected": ["line_editor", "character_expert", "continuity_expert", "timeline_expert"],
  "editor_in_chief_impact": "Primary owner. Runtime validation enforces EIC synthesis boundaries pre-expert.",
  "platform_impact": "lib/editorial-profile contract, lifecycle, validation, versioning, feature flag",
  "certification_impact": "No commercial enablement change.",
  "propagation_decision": "move_to_editor_in_chief",
  "review_artifact_path": "docs/governance/implementation/EDITORIAL_PROFILE_RUNTIME_IMPLEMENTATION.md"
}
```

## Scope (this slice)

| Delivered | Deferred |
|-----------|----------|
| Contract types for all 10 sections | Profile synthesis service (EP-2) |
| 7-level evidence hierarchy constants | Persistence + migration (EP-3) |
| 11-state lifecycle with transition guards | Roadmap Stage 1 wiring (EP-4) |
| Draft / activation validation | Author dispute UI (EP-5) |
| Versioning + supersession helpers | Expert context injection (EP-6) |
| Feature flag `STUDIO_EDITORIAL_PROFILE_ENABLED` | Provider/model synthesis |

## Capability propagation

- **Owner:** Editor-in-Chief (`editor_in_chief_owned`)
- **Decision:** `move_to_editor_in_chief`
- **Downstream consumers deferred:** initial roadmap creation, EIC plan gate, editorial roadmap, expert context injection

## Author control boundaries

- EIC owns profile synthesis after independent read
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
| `contract.ts` | Version, statuses, vocabularies, thresholds, capability/author-control constants |
| `types.ts` | `EditorialProfileV1` and section block types |
| `lifecycle.ts` | Valid/invalid status transitions, activation guards |
| `validation.ts` | Structural, draft, activation validation; evidence hierarchy enforcement |
| `versioning.ts` | Supersession, immutability, alignment-only patches |
| `feature-flag.ts` | `STUDIO_EDITORIAL_PROFILE_ENABLED` gate |

## Tests

```bash
node --import ./scripts/test-path-alias.mjs --experimental-strip-types --test lib/editorial-profile/editorial-profile.test.ts
```

## Governance traceability

- Framework: [STORYDNA_EDITORIAL_PROFILE_FRAMEWORK.md](./STORYDNA_EDITORIAL_PROFILE_FRAMEWORK.md)
- PRD: [STORYDNA_EDITORIAL_PROFILE_PRD.md](./STORYDNA_EDITORIAL_PROFILE_PRD.md)
- Registry: `cap.editorial_profile` in [CAPABILITY_REGISTRY.json](../capabilities/CAPABILITY_REGISTRY.json)
