# Expert Registry (Milestone 2 · Phase 1)

StoryDNA’s **Expert Registry** is the **professional constitution** of every StoryDNA expert — not a prompt repository. It defines *who* an expert is, *what they understand*, *what they are qualified to evaluate*, *what they must not evaluate*, *what standards* they follow, *how* they evaluate work, and *what evidence* they require — without tying identity to any LLM provider or prompt string.

## Architectural model

Experts are not modeled as undifferentiated prompt blobs. Each `ExpertDefinitionV1` preserves these conceptual layers:

```
Expert Identity
    ↓
Professional Standards
    ↓
Knowledge Domains        (what the expert understands)
    ↓
Competencies             (what the expert is qualified to evaluate)
    ↓
Limitations              (what the expert is NOT qualified to evaluate)
    ↓
Evaluation Framework
    ↓
Evidence Policy
    ↓
Execution Profile
```

The database stores one authoritative JSONB snapshot per expert version, but TypeScript types and validation preserve the separation above.

### Competency boundaries

**Competencies** and **limitations** enable the future Editor-in-Chief to assemble the right review team instead of treating every expert as interchangeable. When a concern falls outside an expert’s competency, orchestration should request a specialist.

**Professional responsibility** distinguishes:

| Field | Meaning |
|-------|---------|
| `should_evaluate` | Core mandate — primary evaluation scope |
| `may_evaluate` | Permitted but not primary |
| `must_not_evaluate` | Explicit out-of-scope — defer to specialist |

### Domain confidence (future)

The schema supports optional `domain_confidence` entries (`domain`, `confidence_percent` 0–100). Phase 1 may store **declarative competency ceilings** in seeds; live calculation is deferred to Expert Runtime Phase 2+.

Example (Literary Agent registry mirror):

- Commercial marketability — 95%
- Military realism — 40% (defer to Military Expert)
- Medical realism — 15% (defer to Medical Expert)

## Identity vs execution

| Concept | Phase 1 | Future |
|--------|---------|--------|
| Expert definition | Stored in `expert_versions.definition` | Same |
| Expert execution | **Not wired** — Literary Agent still uses `LITERARY_AGENT` in code | **Execute Expert** via `expert_version_id` |
| Prompt assembly | Code-defined for Literary Agent | Assembled from registry + runtime |
| Orchestration | Publishing Workflow Engine (M1) | Editor-in-Chief selects experts by competency |

**Cursor is a development tool only.** Nothing in the registry requires Cursor at runtime.

### Execute Expert (not Execute Literary Agent)

Phase 2 will architect around **Execute Expert**: Publishing Workflow receives `expert_version_id` rather than hard-coded reviewer types. Expert identity remains independent of workflow execution. Phase 1 documents this direction only — no runtime changes.

## Evidence-first philosophy

StoryDNA experts do not begin with conclusions. They begin with evidence:

```
Evidence → Reasoning → Observation → Recommendation
```

Experts never search for evidence to justify an opinion. They derive opinions from evidence. Unsupported opinions are never published.

See [Evidence-Backed Expert Commentary](./EVIDENCE-BACKED-EXPERT-COMMENTARY.md).

## Future Editor-in-Chief orchestration

Documented triggers for automatic specialist referral (not implemented in Phase 1):

- A concern falls **outside the active expert’s competency**
- An expert’s **limitation** is encountered
- **Domain confidence** falls below threshold
- **Contrary evidence** requires another specialty

## Scopes

| Scope | Meaning |
|-------|---------|
| `platform` | Curated permanent StoryDNA expert |
| `project` | Manuscript/series-specific expert |
| `dynamic` | Created for a specific editorial need |
| `custom` | Future author/org-defined expert (schema-ready, not enabled) |

## Lifecycle

```
draft → active → deprecated → archived
         ↑
    (supersession creates new draft from active)
```

Rules:

1. **Active versions are immutable** (DB trigger + application guards).
2. Editing an active version creates a **new draft** via `createSupersedingDraft`.
3. **Activation is atomic** — `activate_expert_version` RPC deprecates prior active and activates draft in one transaction.
4. Only **one active version** per expert identity.
5. Executions must reference **`expert_version_id`**, not `expert_key` alone (future wiring).

## Database tables

- `experts` — identity, scope, category
- `expert_versions` — versioned definition snapshots + `definition_hash`
- `expert_version_events` — append-only audit log

Migration: `supabase/migrations/0024_expert_registry.sql`

## TypeScript modules

```
lib/expert-registry/
  types.ts              ExpertDefinitionV1, competencies, limitations, domain_confidence
  schema.ts             Validation (no Zod — hand-rolled)
  definition-hash.ts    SHA-256 canonical JSON hashing
  evidence-types.ts     Evidence enums
  evidence-profiles.ts  Code-defined reusable profiles
  store.ts              Server-only Supabase CRUD
  lifecycle.ts          Transition validation
  platform-guard.ts     Privileged writes for platform experts
  seed.ts               Idempotent platform seeding
  list-experts.ts       Read-only inspection
  adapters/reviewer-definition.ts  Code → registry mirror
```

## Security (Phase 1 limitation)

- **Single-tenant** — RLS allows read for anon/authenticated; writes only via service role.
- Platform expert writes require explicit `seed` | `admin` | `system` context.
- Definitions must not contain API secrets or manuscript text.
- Definition hashes detect tampering on retrieval.

## Literary Agent (non-migration)

The current Literary Agent pipeline in `lib/ai/review-engine.ts` is **unchanged**. A registry mirror seed exists with `execution_wired: false` and `runtime_source: lib/ai/review-engine.ts#LITERARY_AGENT`.

No production code reads expert definitions from the database in Phase 1.

## Seeds (idempotent)

Platform draft seeds:

1. **Editor-in-Chief** — orchestration placeholder, not runtime-wired
2. **Literary Agent** — registry mirror with explicit competencies/limitations/domain confidence
3. **Developmental Editor** — full schema example

Run via `seedPlatformExperts()` (server-only; not run against production in Phase 1).

## Deferred (Phase 2+)

- Expert Runtime (**Execute Expert** via `expert_version_id`)
- Editor-in-Chief automatic expert selection by competency
- Live domain confidence calculation
- Roundtable / multi-expert execution
- Dynamic expert generation
- Author-created custom experts
- `expert_version_id` on reviews and workflows
- Evidence observation tables (`expert_observations`, `expert_evidence`, etc.)

See also: [Evidence-Backed Expert Commentary](./EVIDENCE-BACKED-EXPERT-COMMENTARY.md), [Professional Standards](./EXPERT-PROFESSIONAL-STANDARDS.md).
