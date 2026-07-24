# Multi-Version Expert Runtime Registry API (P2-10)

**Status:** Design contract — no runtime wiring, no DB migration, no behavior change.  
**Baseline:** `origin/main` @ `37f8cf215412c37e075ccc214c49f8c25caa1fb6`  
**Scope:** Expert Review Engine in-code registry contract for future multi-version coexistence and DB parity.

---

## 1. Current-state findings

### In-code registry (`lib/expert-review-engine/registry/in-code.ts`)

The Phase 1 in-code registry is a **single-version-per-expert** store:

| Structure | Key | Value | Semantics |
|-----------|-----|-------|-----------|
| `definitionsByKey` | `expert_key` | `ExpertRuntimeRegistryEntry` | **One slot per expert** — second registration with same key throws |
| `versionIndex` | `` `${expert_key}@${expert_version}` `` | `Set<expert_key>` | Duplicate `(key, version)` throws; never populated with multiple keys per version entry today |

**Bootstrap:** `bootstrapExpertRuntimeRegistry()` registers exactly one definition — Literary Agent (`literary_agent` / `v1.0.0-certified`). Idempotent via early return when `definitionsByKey.size > 0`.

**Public API today:**

| Function | Lookup | Notes |
|----------|--------|-------|
| `getExpertRuntimeDefinition(expertKey)` | By `expert_key` only | Returns the sole registered entry; filters `enabled: false` unless `includeDisabled` |
| `listExpertRuntimeDefinitions()` | All entries | Same enabled filter |
| `resolveExpertsByCapability(capability)` | Capability scan | Uses list + filter |
| `getExpertRuntimeVersionMetadata(expertKey)` | By key | Returns `ReviewRuntimeVersionSet` |
| `computeDefinitionHashForExpert(expertKey)` | By key | Recomputes hash from stored definition |
| `registerExpertRuntimeDefinition(def)` | Write | Throws `ExpertRegistryError` on duplicate key **or** duplicate `(key, version)` |

**No lookup exists for:** `expert_version`, `definition_hash`, `expert_version_id`, lifecycle status, or active-vs-historical resolution.

### Registration conflict behavior (observed)

```typescript
// Rejected: same expert_key, different expert_version
registerExpertRuntimeDefinition({ ...def, expert_version: "v9.9.9" });
// → ExpertRegistryError: Duplicate expert_key: literary_agent

// versionIndex is written but never read by any public function
versionIndex.set(vKey, new Set([def.expert_key]));
```

Attempting a second version of the same expert fails at the **`expert_key` uniqueness check** before version coexistence is even considered. The `versionIndex` structure anticipates multi-key-per-version (unlikely) but is unused for reads.

### Hash and validation pipeline

- **`definition_hash`** (runtime): SHA-256 of canonical JSON of full `ExpertRuntimeDefinition` with `runtime_versions.definition_hash` omitted (`hashExpertRuntimeDefinition`). Validated at registration — stored hash must match computed hash.
- **`constitution_definition_hash`**: SHA-256 of `ExpertDefinitionV1` produced by `reviewerDefinitionToExpertDefinition` adapter. Independent string in `ReviewRuntimeVersionSet`; changing constitution adapter output does not auto-update runtime hash.
- **`workflow_definition_version`**: Stable identifier (e.g. `literary_agent_review@v1`), validated against `VERSION_IDENTIFIER_PATTERN`.
- **Certified Literary Agent hashes (must remain unchanged):**
  - Runtime: `f4006eaa497dd1d821f30fdac33dcb4869eff68d1af46b1f7401a972020ca50b`
  - Constitution adapter: `8f8b56a9de6c7d68f96fd7913645905ee2afb8ce7d0c066faba2c28106fe94f5`
  - Registry seed: `f6b79bc07d7ba9630fb532c67c31c4b80bac2886002696e25290d163e4b44671`

### DB registry (`lib/expert-registry/`, migration `0024_expert_registry.sql`)

Already multi-version capable:

- `experts`: identity scoped by `(expert_key, scope[, manuscript_id])`
- `expert_versions`: **unique `(expert_id, version)`**, one **active** per expert (partial unique index), lifecycle `draft | active | deprecated | archived`
- Immutability trigger on active/deprecated/archived core fields
- `activate_expert_version` RPC atomically deprecates prior active
- Lookups: `getExpertVersion(uuid)`, `getActiveExpertVersion(expertId)`, `listExpertVersions(expertId)`
- Hash verification on every `getExpertVersion` retrieval

**Gap:** No DB table stores `ExpertRuntimeDefinition` or runtime `definition_hash`. Constitution lives in `expert_versions.definition`; runtime is in-code only.

### Consumers of `expert_key` and `definition_hash`

| Consumer | Uses `expert_key` | Uses `definition_hash` |
|----------|-------------------|------------------------|
| `in-code.ts` registry | Primary map key | Stored on entry; no hash lookup |
| `recommend-experts.ts` | Assignment routing | No |
| `runtime-version-set.test.ts` | Indirect | Asserts certified hashes |
| `hash-tampering.test.ts` | Registration | Tamper detection |
| `expert-registry/store.ts` | Identity CRUD | Constitution hash on versions |
| `ExpertVersionRef` type | Yes | Yes (future review reference) |

**Expert Review Engine execution (`runExpertReview`) is not wired.** Literary Agent production path remains `LITERARY_AGENT` in `lib/ai/review-engine.ts`.

---

## 2. Identifier semantics

### `expert_key`

- **Role:** Stable human/logical expert identity within a scope.
- **Pattern:** `^[a-z][a-z0-9_]*$` (runtime validation).
- **Uniqueness:** One identity per `(scope, expert_key[, manuscript_id])` in DB; one slot per `expert_key` in in-code registry today.
- **Not sufficient alone for execution pinning** — always pair with version or `expert_version_id`.

### `expert_version`

- **Role:** Semver-like release label for a specific runtime/constitution snapshot (e.g. `v1.0.0-certified`, `v1-registry-mirror`).
- **Uniqueness:** **Per expert only** — `(expert_key, expert_version)` or DB `(expert_id, version)`.
- **Not globally unique** — `v1.0.0` on `literary_agent` ≠ `v1.0.0` on `developmental_editor`.
- **Distinct from** component version pins inside `ReviewRuntimeVersionSet` (e.g. `prompt_version`, `rubric_version`) which describe sub-artifacts of one runtime version.

### `definition_hash`

- **Role:** Content-addressable fingerprint of the **runtime definition body** (excluding self-referential `definition_hash` field).
- **Format:** 64-char lowercase hex SHA-256.
- **Valid as lookup identifier:** **Yes**, for audit replay and tamper detection. Treat as **secondary** to `(expert_key, expert_version)` because:
  - No uniqueness constraint in DB today (could add optional unique index later).
  - Theoretically distinct experts could produce identical canonical bodies (negligible SHA-256 collision risk).
- **Distinct from** constitution `definition_hash` on `ExpertDefinitionV1` / `expert_versions.definition_hash` — different serialization, different hash input.

### `constitution_definition_hash`

- **Role:** Links runtime audit record to constitution-side `ExpertDefinitionV1` snapshot.
- **Stored in:** `ReviewRuntimeVersionSet.constitution_definition_hash`.
- **Lookup:** Audit correlation only in P2-10; future bridge to `expert_versions.definition_hash` when runtime and constitution versions align.

### `workflow_definition_version`

- **Role:** Publishing workflow contract pin (e.g. `literary_agent_review@v1`).
- **Stored in:** `ReviewRuntimeVersionSet.workflow_definition_version` and `publishing_policy.workflowDefinitionVersion`.
- **Lookup:** Execution audit and workflow compatibility checks — not registry primary key.

### `expert_version_id` (future UUID)

- **Role:** Authoritative execution reference for **Execute Expert** model (`ExpertVersionRef.expert_version_id`).
- **Source:** `expert_versions.id` in DB.
- **In-code registry:** Optional nullable field on entries once DB-backed registry exists; in-code-only entries use `null` with synthetic resolution deferred to activation time.
- **Execution rule:** Workflows and review records should persist `expert_version_id` + `definition_hash` + `ReviewRuntimeVersionSet` for replay.

---

## 3. Proposed TypeScript interface

Contract types live in `lib/expert-review-engine/registry/multi-version-contract.ts` (design-only; not wired to `in-code.ts`).

### Core registry interface (future implementation)

```typescript
interface ExpertRuntimeRegistry {
  /** Default execution lookup — active, enabled version for expert_key. */
  getActiveExpertRuntime(
    expertKey: string,
    options?: ExpertRegistryReadOptions,
  ): ExpertRegistryResult<ExpertRuntimeRegistryEntry>;

  /** Pin-specific version — required for replay and duplicate-review policy. */
  getExpertRuntimeByKeyAndVersion(
    expertKey: string,
    expertVersion: string,
    options?: ExpertRegistryReadOptions,
  ): ExpertRegistryResult<ExpertRuntimeRegistryEntry>;

  /** Audit replay — resolve entry whose runtime definition_hash matches. */
  getExpertRuntimeByDefinitionHash(
    definitionHash: string,
    options?: ExpertRegistryReadOptions,
  ): ExpertRegistryResult<ExpertRuntimeRegistryEntry>;

  /** List all registered versions for an expert (any lifecycle). */
  listExpertRuntimeVersions(
    expertKey: string,
    options?: ExpertRegistryListOptions,
  ): ExpertRegistryResult<readonly ExpertRuntimeVersionSummary[]>;

  /** Existence probe — version optional (checks any version if omitted). */
  existsExpertRuntime(
    query: ExpertRuntimeExistsQuery,
  ): ExpertRegistryResult<boolean>;

  /** Register new version — enforces conflict rules (§7). */
  registerExpertRuntimeDefinition(
    def: ExpertRuntimeDefinition,
    options?: ExpertRegistryRegisterOptions,
  ): ExpertRegistryResult<ExpertRuntimeRegistryEntry>;

  /** Bridge to DB identity — returns UUID when known. */
  resolveExpertVersionId(
    expertKey: string,
    expertVersion: string,
  ): ExpertRegistryResult<string | null>;
}
```

### Supporting types

```typescript
interface ExpertRuntimeVersionSummary {
  expertKey: string;
  expertVersion: string;
  definitionHash: string;
  lifecycleStatus: ExpertRuntimeLifecycleStatus;
  enabled: boolean;
  registeredAt: string;
  expertVersionId: string | null;
}

type ExpertRuntimeLifecycleStatus =
  | "draft"
  | "active"
  | "deprecated"
  | "archived";

interface ExpertRegistryReadOptions {
  includeDisabled?: boolean;
  /** When false (default), active lookup excludes draft/archived. */
  lifecycleFilter?: ExpertRuntimeLifecycleStatus[];
}

interface ExpertRegistryListOptions extends ExpertRegistryReadOptions {
  /** Include deprecated/archived for audit UIs. Default: all non-draft. */
  includeHistorical?: boolean;
}

interface ExpertRegistryRegisterOptions {
  lifecycleStatus?: "draft" | "active";
  expertVersionId?: string | null;
  /** If registering as active, deprecate prior active (mirrors DB RPC). */
  activate?: boolean;
}

interface ExpertRuntimeExistsQuery {
  expertKey: string;
  expertVersion?: string;
  definitionHash?: string;
  lifecycleStatus?: ExpertRuntimeLifecycleStatus;
}
```

### Extended registry entry (future)

```typescript
interface ExpertRuntimeRegistryEntryV2 extends ExpertRuntimeRegistryEntry {
  expertVersionId: string | null;
  lifecycleStatus: ExpertRuntimeLifecycleStatus;
  /** True when this entry is the sole active version for expert_key. */
  isActive: boolean;
}
```

---

## 4. Typed errors/results

All lookup/register operations return **`ExpertRegistryResult<T>`** — discriminated union, no thrown errors for expected miss paths (throws reserved for programmer errors / corrupt state).

### Error codes

| Code | When |
|------|------|
| `expert_not_found` | No entry for `expert_key` (any version) |
| `version_not_found` | Expert exists but `(expert_key, expert_version)` missing |
| `definition_hash_not_found` | No entry with matching runtime `definition_hash` |
| `duplicate_version` | Register would violate `(expert_key, expert_version)` uniqueness |
| `conflicting_definition_hash` | Same `(expert_key, expert_version)` with different hash, or hash already bound to different key/version |
| `no_active_version` | `getActiveExpertRuntime` — expert has versions but none active+enabled |
| `invalid_lookup` | Malformed key/version/hash pattern, or mutually inconsistent query |

### Result shape

```typescript
type ExpertRegistryErrorCode =
  | "expert_not_found"
  | "version_not_found"
  | "definition_hash_not_found"
  | "duplicate_version"
  | "conflicting_definition_hash"
  | "no_active_version"
  | "invalid_lookup";

interface ExpertRegistryError {
  ok: false;
  code: ExpertRegistryErrorCode;
  message: string;
  context?: Record<string, string>;
}

interface ExpertRegistrySuccess<T> {
  ok: true;
  value: T;
}

type ExpertRegistryResult<T> = ExpertRegistrySuccess<T> | ExpertRegistryError;
```

**Migration from today:** `getExpertRuntimeDefinition` returning `null` maps to `expert_not_found` or `no_active_version` depending on whether historical versions exist.

---

## 5. Lookup semantics

| Operation | Input | Success | Failure |
|-----------|-------|---------|---------|
| **Get active** | `expert_key` | Single entry where `lifecycleStatus === "active"` AND `enabled === true` (unless `includeDisabled`) | `expert_not_found`, `no_active_version` |
| **Get by key+version** | `expert_key`, `expert_version` | Exact match regardless of lifecycle (unless filtered) | `expert_not_found`, `version_not_found` |
| **Get by hash** | `definition_hash` | Entry where `entry.definitionHash === hash` | `definition_hash_not_found`, `invalid_lookup` (bad format) |
| **List versions** | `expert_key` | All matching entries sorted by `registeredAt` desc | `expert_not_found` if key unknown and strict mode; empty list if key known with zero versions |
| **Exists** | key ± version ± hash ± lifecycle | `true` / `false` | `invalid_lookup` only |
| **Resolve expert_version_id** | `expert_key`, `expert_version` | UUID string or `null` (in-code-only) | `version_not_found` |

### Precedence rules

1. **Execution default:** `getActiveExpertRuntime` — never infer active from highest semver; lifecycle flag is authoritative (matches DB).
2. **Replay:** Prefer `getExpertRuntimeByDefinitionHash` when audit record stores hash; fall back to key+version.
3. **Orchestration (Editor-in-Chief):** Capability resolution uses **active** entries only unless plan pins `expertVersion`.
4. **Disabled vs lifecycle:** `enabled: false` excludes from active/default lists but entry remains retrievable by key+version or hash with `includeDisabled: true`.

---

## 6. Active-version semantics

Aligned with DB `expert_versions` lifecycle (see `docs/EXPERT-REGISTRY.md`):

| Rule | Semantics |
|------|-----------|
| At most one **active** per `expert_key` | Enforced on register/activate; mirrors `expert_versions_one_active_per_expert` |
| **Active** is the default execution target | `getActiveExpertRuntime` |
| **Draft** | Registered but not executable as active until activation |
| **Deprecated** | Historical; executable for in-flight/replay with explicit version pin |
| **Archived** | Retrievable for audit; not eligible for new executions |
| **Historical retrievable** | Always via key+version and definition_hash |
| **Immutability** | Active/deprecated/archived definition bodies immutable — new content → new version row/entry |
| **Activation** | Atomic: new active deprecates prior active (DB RPC pattern) |
| **In-code bootstrap** | Literary Agent registers as `active` + `enabled: true` — preserves today's behavior |

**`enabled` flag:** Orthogonal to lifecycle — allows soft-disable of active version without archiving (matches current `includeDisabled` pattern).

---

## 7. Registration/conflict semantics

### Allowed

- Register **new** `(expert_key, expert_version)` while other versions of same expert exist (multi-version — **not supported today, required for P2-12+**).
- Register same content under new version label (new row; new hash if body differs).
- Idempotent re-register of **identical** definition (same key, version, hash) → success, no-op or return existing (implementation choice; prefer no-op).

### Rejected

| Condition | Error |
|-----------|-------|
| Duplicate `(expert_key, expert_version)` with **different** body/hash | `conflicting_definition_hash` |
| Duplicate `(expert_key, expert_version)` with **identical** hash | `duplicate_version` (or idempotent success — document either) |
| `definition_hash` already registered to **different** `(key, version)` | `conflicting_definition_hash` |
| Second **active** without deprecating first | `conflicting_definition_hash` or dedicated activation error |
| Invalid definition (validation fail) | `invalid_lookup` with validation detail |
| Duplicate `expert_key` only (today's behavior) | **`Removed in multi-version API** — replaced by per-version slots |

### Preserve history

- Never overwrite or delete prior version entries on new registration.
- Deprecation marks prior active; does not remove from `versionIndex` or hash index.

---

## 8. In-code registry mapping

### Current → proposed structure

| Current | Proposed |
|---------|----------|
| `Map<expert_key, Entry>` (1:1) | `Map<expert_key, Map<expert_version, Entry>>` or composite key `` `${key}@${version}` `` |
| `versionIndex: Map<key@version, Set<expert_key>>` | **Hash index:** `Map<definition_hash, compositeKey>` + keep version index for uniqueness |
| No lifecycle | `lifecycleStatus` + `isActive` on entry |
| `registerExpertRuntimeDefinition` throws | Returns `ExpertRegistryResult` (throws for invariant bugs only) |
| `getExpertRuntimeDefinition(key)` | Alias for `getActiveExpertRuntime` during transition |

### Compatibility assessment

| Aspect | Risk | Mitigation |
|--------|------|------------|
| Literary Agent bootstrap | Low | Single version registers as active; `getExpertRuntimeDefinition` unchanged through adapter |
| Certified hash | **Critical** | No change to `literaryAgentRuntimeDefinition()` or hash algorithm |
| Editor-in-Chief | Low | Continues to resolve by capability → active entry |
| Tests expecting duplicate key throw | Medium | Update in P2-12; P2-10 only adds contract doc + types |
| `versionIndex` unused reads | None | Replace with hash index + version uniqueness set |

### Phased implementation (post P2-10)

1. **P2-10:** Contract doc + types (this deliverable).
2. **P2-12:** Refactor `in-code.ts` storage to multi-version maps behind compatibility shims.
3. **Later:** DB-backed registry implements same interface; in-code becomes seed/cache.

---

## 9. Future database mapping

No SQL or migration in P2-10. Conceptual mapping when runtime definitions persist:

| Contract field | DB location (future) |
|----------------|----------------------|
| `expert_key` | `experts.expert_key` |
| `expert_version` | `expert_versions.version` |
| `expert_version_id` | `expert_versions.id` |
| Constitution `definition_hash` | `expert_versions.definition_hash` |
| Runtime `definition_hash` | **New column or table** e.g. `expert_runtime_versions.definition_hash` + JSONB `runtime_definition` |
| `lifecycleStatus` | `expert_versions.lifecycle_status` (shared lifecycle for constitution; runtime row follows) |
| `ReviewRuntimeVersionSet` | JSONB column on runtime version row — full audit snapshot |
| `registeredAt` | `expert_versions.created_at` |
| Active uniqueness | Existing partial unique index on `(expert_id) WHERE lifecycle_status = 'active'` |

### Dual-layer model

```
experts (identity)
  └── expert_versions (constitution ExpertDefinitionV1 + lifecycle)
        └── expert_runtime_versions (future — ExpertRuntimeDefinition + runtime definition_hash)
```

Constitution and runtime versions may diverge in label (`v1-registry-mirror` vs `v1.0.0-certified`) but link via `constitution_definition_hash` in `ReviewRuntimeVersionSet`.

### Store parity

Existing `lib/expert-registry/store.ts` functions map to registry interface:

| Store function | Registry equivalent |
|----------------|---------------------|
| `getActiveExpertVersion(expertId)` | `getActiveExpertRuntime` (+ scope resolution) |
| `getExpertVersion(id)` | `resolveExpertVersionId` inverse + fetch |
| `listExpertVersions(expertId)` | `listExpertRuntimeVersions` |
| `createDraftExpertVersion` | `register` with `lifecycleStatus: draft` |
| `activateExpertVersion` | `register`/`activate` with atomic deprecate |

---

## 10. Execution audit record

Every future `runExpertReview()` invocation must persist (design contract only):

```typescript
interface ExpertReviewExecutionAuditRecord {
  /** Primary execution reference */
  expert_version_id: string | null;
  expert_key: string;
  expert_version: string;

  /** Content pins — must match resolved registry entry */
  runtime_definition_hash: string;
  review_runtime_version_set: ReviewRuntimeVersionSet;

  /** Engine context */
  engine_version: string;
  executed_at: string;

  /** Optional workflow correlation */
  workflow_definition_version: string;
  manuscript_id?: string;
  review_id?: string;
}
```

### Invariants

1. `review_runtime_version_set.definition_hash === runtime_definition_hash`
2. `review_runtime_version_set.expert_version === expert_version`
3. Resolved entry's `definitionHash` matches stored hash before execution starts
4. Hash mismatch → abort (`failClosed`) — same spirit as `verifyExpertDefinitionHash` on DB read
5. Replay loads via `getExpertRuntimeByDefinitionHash` first, validates full `ReviewRuntimeVersionSet`

### Relationship to `duplicateReviewPolicy`

`editor_in_chief_rules.duplicateReviewPolicy: "block_same_expert_same_version"` requires key+version lookup and historical execution log — not expert_key alone.

---

## 11. Concurrency behavior

| Scenario | Behavior |
|----------|----------|
| Concurrent read | Lock-free; entries deeply frozen (existing `deepFreeze`) |
| Concurrent register same version | One wins; other gets `duplicate_version` or `conflicting_definition_hash` |
| Concurrent activate | DB: transactional RPC; in-code: single-process mutex or compare-and-swap on active pointer |
| Register during read | Readers see snapshot before or after complete registration — no partial entry |
| Bootstrap race | Idempotent — first caller registers Literary Agent; others no-op |
| DB + in-code hybrid (future) | DB is source of truth; in-code cache TTL/invalidation on activation events |

**P2-10:** Document only. Current process is single-threaded Node; no locking added.

---

## 12. Migration acceptance criteria

Before declaring multi-version registry **implemented** (future P2-12+):

- [ ] Literary Agent runtime hash unchanged: `f4006eaa497dd1d821f30fdac33dcb4869eff68d1af46b1f7401a972020ca50b`
- [ ] Constitution adapter hash unchanged: `8f8b56a9de6c7d68f96fd7913645905ee2afb8ce7d0c066faba2c28106fe94f5`
- [ ] Registry seed hash unchanged: `f6b79bc07d7ba9630fb532c67c31c4b80bac2886002696e25290d163e4b44671`
- [ ] Two versions of same expert can register without `Duplicate expert_key` error
- [ ] `getExpertRuntimeDefinition("literary_agent")` returns active version (backward compat)
- [ ] `getExpertRuntimeByKeyAndVersion("literary_agent", "v1.0.0-certified")` returns certified entry
- [ ] `getExpertRuntimeByDefinitionHash` resolves certified hash
- [ ] At most one active version per expert enforced
- [ ] All existing `npm test` pass; `tsc --noEmit` clean
- [ ] No production Literary Agent / Trigger / UI / editorial-generation behavior change
- [ ] `runExpertReview()` remains unwired until explicit milestone
- [ ] Certified git tag unchanged: `literary-agent-v1-certified^{}` → `3e61b0e3021c055baa0c2fab09ad51e92b69d439`

---

## 13. Open questions

1. **Runtime persistence table:** Separate `expert_runtime_versions` vs JSONB column on `expert_versions`?
2. **Hash index uniqueness:** Global unique index on runtime `definition_hash` — yes/no?
3. **Idempotent register:** Return existing entry vs `duplicate_version` when exact duplicate submitted?
4. **Constitution/runtime version label alignment:** Require matching version strings or allow divergent labels linked by hash?
5. **Scope in in-code registry:** Should in-code registry keys include `scope` or remain platform-only?
6. **Project-scoped experts:** Same `expert_key` on different manuscripts — composite identity `(scope, manuscript_id, expert_key)`?
7. **Activation in in-code registry:** Mirror full DB RPC or defer activation to DB-only until hybrid registry?
8. **expert_version_id for in-code-only entries:** Synthetic UUIDs vs null until DB sync?

---

## 14. Explicit non-goals (P2-10)

- Implement multi-version storage refactor in `in-code.ts` (**P2-12**)
- Database-backed Expert Registry wiring or migration **0024** changes
- Implement or wire `runExpertReview()`
- Modify Literary Agent production execution, Trigger jobs, UI, editorial-generation, publishing
- Change runtime hashing algorithm or certified definition bodies
- Deploy, run migrations, invoke models, touch staging
- Create pull request or commit (per task instructions)

---

## Appendix: Investigation Q&A summary

| # | Question | Answer |
|---|----------|--------|
| 1 | Expert identity | `expert_key` within scope (DB adds scope/manuscript) |
| 2 | Runtime version identity | `(expert_key, expert_version)` + content `definition_hash` |
| 3 | `expert_version` uniqueness | Per expert only |
| 4 | `definition_hash` as lookup | Valid for audit replay; secondary to key+version |
| 5 | Multiple versions coexist | **No** today; **yes** in proposed API |
| 6 | `versionIndex` on duplicate | **Rejects** with `ExpertRegistryError` |
| 7 | Lifecycle treatment | DB full lifecycle; in-code only `enabled`; proposed API adopts DB semantics |
| 8 | Future execution lookups | Active, key+version, hash, list, exists, register, resolve UUID |
