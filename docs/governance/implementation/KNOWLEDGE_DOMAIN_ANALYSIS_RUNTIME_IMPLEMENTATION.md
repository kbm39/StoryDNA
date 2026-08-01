# Knowledge Domain Analysis Runtime Implementation

**Contracts:** `storydna_knowledge_domain_analysis@v1`  
**Location:** `lib/knowledge-domain-analysis/`

## Constitution Compliance

```json
{
  "applicable_sections": ["§0", "§1", "§6", "§8", "§10", "§12", "§13", "§14", "Amendment 001", "Amendment 002"],
  "compliance_explanation": "KDA-1 implements EIC-owned knowledge domain analysis contract, validation, lifecycle, versioning, audit, confirmation foundation, and profile projection contract. KDA-2 adds deterministic Independent Read → KDA candidate synthesis without enabling experts, granting manuscript access, performing provider calls, or generating roadmaps.",
  "amendment_required": "No",
  "backward_compatibility_impact": "Additive lib modules; flags default off.",
  "certification_impact": "No commercial enablement. KDA remains orchestration metadata only."
}
```

## Capability Propagation Review

```json
{
  "new_capability_introduced": "Knowledge Domain Analysis runtime foundation (KDA-1)",
  "existing_capability_modified": "cap.knowledge_domain_analysis — contract types, validation, and Independent Read candidate synthesis",
  "classification": "editor_in_chief_owned",
  "existing_experts_evaluated": ["literary_agent", "military_expert", "developmental_editor", "editor_in_chief"],
  "future_experts_affected": ["police_procedure_expert", "organized_crime_expert", "criminal_law_expert"],
  "editor_in_chief_impact": "Primary owner. Contract encodes EIC-owned domain analysis artifact boundaries.",
  "platform_impact": "lib/knowledge-domain-analysis/",
  "certification_impact": "No commercial enablement change.",
  "propagation_decision": "move_to_editor_in_chief",
  "review_artifact_path": "docs/governance/implementation/KNOWLEDGE_DOMAIN_ANALYSIS_RUNTIME_IMPLEMENTATION.md"
}
```

## Scope — KDA-1 (this slice)

| Delivered | Deferred |
|-----------|----------|
| `storydna_knowledge_domain_analysis@v1` contract types | Persistence + migration (KDA-3) |
| Domain, mapping, recommendation, gap, response models | Automatic domain detection (KDA-4) |
| Evidence model with placeholder rejection | Provider synthesis |
| 11-state lifecycle + transition guards | `confirmEicPreExpertArtifacts()` joint gate (KDA-10) |
| Draft / confirmation / activation validation | Profile projection orchestration (KDA-7) |
| Versioning + supersession helpers | Author-facing read model (KDA-8) |
| Append-only audit helpers | Studio UI (KDA-11) |
| KDA EIC confirmation record builder | Expert Registry resolution service (KDA-5) |
| Profile projection contract builder | Telemetry delivery |
| Feature flags (master + recommendations sub-flag) | Calibration benchmarks (KDA-13) |
| Police / mob / criminal law deterministic fixture | Expert creation (KDA-14) |
| 70 unit tests | |

## Scope — KDA-2 (this slice)

| Delivered | Deferred |
|-----------|----------|
| `createKnowledgeDomainAnalysisCandidateFromIndependentRead()` orchestration | Persistence + migration (KDA-3) |
| Independent Read eligibility checks (reuses EP-2 read validation) | Provider-based synthesis (KDA-4) |
| Deterministic evidence-driven domain synthesis from read signals | Structured-output repair pipeline |
| Bounded synthesis input builder | `confirmEicPreExpertArtifacts()` joint gate (KDA-10) |
| Capability registry stub + registry gaps | Full Expert Registry resolution service (KDA-5) |
| Specialist recommendation candidates (non-active boundaries) | Profile projection orchestration (KDA-7) |
| Police / mob / criminal law / military distinction in synthesis | Author-facing read model (KDA-8) |
| Plain-English domain explanations | Studio UI (KDA-11) |
| Provenance + append-only audit on candidate creation | Telemetry delivery |
| 46 candidate unit tests (+ 70 foundation tests) | Expert creation (KDA-14) |

### KDA-2 flow

```
Completed Independent Read
        ↓
Feature flag + eligibility checks
        ↓
Bounded synthesis input (read + optional intent/understanding)
        ↓
Deterministic domain synthesis (evidence-driven)
        ↓
KDA contract artifact (generating → draft / incomplete_evidence / awaiting_eic_confirmation)
        ↓
validateKdaContract (draft mode)
        ↓
Non-active typed result
```

### KDA-2 entry point

- **Function:** `createKnowledgeDomainAnalysisCandidateFromIndependentRead()`
- **Path:** `lib/knowledge-domain-analysis/candidate-from-independent-read.ts`
- **Eligibility:** `validateIndependentReadForKdaSynthesis()` in same module (wraps EP-2 read validation + provenance)
- **Synthesis:** `synthesizeKdaFromBoundedInput()` in `domain-synthesis.ts`
- **Capability resolution:** `capability-registry.ts` stub (no Expert Registry service)
- **Validation:** `validateKdaContract()` / `validateForDraft()` in `validation.ts`

### Evidence sources supported (KDA-2)

| Source | Representation |
|--------|----------------|
| Manuscript (via read evidence) | `source: "manuscript"` |
| Independent Read interpretation | `source: "independent_read_interpretation"` |
| Author Intent (when loaded) | `source: "author_intent"` |
| Editorial Understanding (when loaded) | framing + conflict detection only |
| EIC synthesis | domain descriptions (not relabeled as manuscript) |
| Specialist findings | **not consumed** |

### Model calls

**No model call added.** Synthesis is deterministic from structured Independent Read signals.

### Repair

**No structured repair added.** Invalid mechanical output returns `failed` / `incomplete_evidence` / `blocked` via existing validation only. Repair must not fabricate evidence, locators, capability coverage, or expert availability.

### Lifecycle results (non-active only)

`draft`, `incomplete_evidence`, `awaiting_eic_confirmation`, `blocked`, `failed` — never `active`.

## Module map

| Module | Purpose |
|--------|---------|
| `contract.ts` | Version, enums, constitutional boundaries, capability metadata |
| `types.ts` | Artifact and sub-contract TypeScript types |
| `lifecycle.ts` | Status transitions and activation guards |
| `validation.ts` | Structural, draft, confirmation, activation validation |
| `versioning.ts` | Supersession and version chain |
| `audit.ts` | Append-only audit events |
| `confirmation.ts` | KDA-side EIC confirmation record builder |
| `projection.ts` | Editorial Profile projection contract builder |
| `feature-flag.ts` | Development-only flags |
| `fixtures/police-organized-crime-fixture.ts` | Deterministic contract fixture (KDA-1) |
| `candidate-from-independent-read.ts` | KDA-2 orchestration entry point |
| `domain-synthesis.ts` | Deterministic domain synthesis from bounded read input |
| `capability-registry.ts` | Capability registry stub + gap/mapping helpers |
| `fixtures/independent-read-kda-fixtures.ts` | Independent Read fixtures for KDA-2 tests |

## Author-control boundaries

- Recommendation ≠ assignment ≠ activation ≠ consent ≠ manuscript sharing  
- Disagreement does not erase EIC conclusions or manuscript evidence  
- Registry gaps remain visible; no unrelated expert substitution  
- `specialist_manuscript_access_count` must be 0  
- No commercial enablement, roadmap generation, or grading  

## Feature flags

| Flag | Default | Requires |
|------|---------|----------|
| `STUDIO_KNOWLEDGE_DOMAIN_ANALYSIS_ENABLED` | off | `STUDIO_EIC_ENABLED=1`, `STUDIO_AUTHOR_INTENT_ENABLED=1` |
| `STUDIO_KNOWLEDGE_DOMAIN_RECOMMENDATIONS_ENABLED` | off | Master KDA flag |

Documented in `.env.example`. **Do not set in `.env.local` as part of this slice.**

## Police / Organized Crime / Criminal Law fixture

`buildPoliceOrganizedCrimeKdaFixture()` represents:

1. **Police Procedure** — central domain; registered `police_procedure` capability; available recommendation  
2. **Organized Crime** — central domain; registry gap; no fake expert  
3. **Criminal Law** — substantial supporting; distinct capability  
4. **Military** — incidental; not recommended; not substituted for police or mob gaps  

## Conformance

```bash
npm run governance:capability-check -- docs/governance/implementation/KNOWLEDGE_DOMAIN_ANALYSIS_RUNTIME_IMPLEMENTATION.md
node --import ./scripts/test-path-alias.mjs --experimental-strip-types --test \
  lib/knowledge-domain-analysis/knowledge-domain-analysis.test.ts \
  lib/knowledge-domain-analysis/candidate-from-independent-read.test.ts
```
