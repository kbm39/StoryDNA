import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { literaryAgentRuntimeDefinition } from "@/experts/literary-agent/runtime-definition.ts";
import { LITERARY_AGENT_EXPERT_VERSION } from "@/experts/literary-agent/runtime-definition.ts";
import {
  EXPERT_REVIEW_ENGINE_FLAG_NAME,
  readExpertReviewEngineEnabled,
} from "./feature-flags.ts";
import { createInCodeExpertRuntimeRegistry } from "./registry/in-code-registry-adapter.ts";
import {
  expertRegistryError,
  type ExpertRuntimeRegistry,
  type ExpertRuntimeRegistryEntryV2,
} from "./registry/multi-version-contract.ts";
import { runExpertReview } from "./run-expert-review.ts";
import type { ExpertReviewRequest } from "./execution-plan.ts";
import { hashExpertRuntimeDefinition } from "./types.ts";
import { withRuntimeDefinitionHash } from "./rehash-runtime-definition.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const RUN_EXPERT_REVIEW_SOURCE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "run-expert-review.ts"),
  "utf8",
);

const EXPECTED_LA_DEFINITION_HASH =
  "f4006eaa497dd1d821f30fdac33dcb4869eff68d1af46b1f7401a972020ca50b";

const MANUSCRIPT_ID = "ms-plan-test-001";
const MANUSCRIPT_VERSION_ID = "msv-plan-test-001";

function baseRequest(
  overrides: Partial<ExpertReviewRequest> = {},
): ExpertReviewRequest {
  return {
    manuscriptId: MANUSCRIPT_ID,
    manuscriptVersionId: MANUSCRIPT_VERSION_ID,
    executionMode: "plan_only",
    expertKey: "literary_agent",
    expertVersion: LITERARY_AGENT_EXPERT_VERSION,
    ...overrides,
  };
}

function mockLiteraryAgentEntry(
  overrides: Partial<ExpertRuntimeRegistryEntryV2> = {},
): ExpertRuntimeRegistryEntryV2 {
  const def = literaryAgentRuntimeDefinition();
  return Object.freeze({
    definition: def,
    definitionHash: EXPECTED_LA_DEFINITION_HASH,
    registeredAt: "2026-01-01T00:00:00.000Z",
    expertVersionId: null,
    lifecycleStatus: "active",
    isActive: true,
    ...overrides,
  });
}

function createMockRegistry(
  entry: ExpertRuntimeRegistryEntryV2 = mockLiteraryAgentEntry(),
  options?: {
    resolveVersionId?: string | null;
    failLookup?: boolean;
  },
): ExpertRuntimeRegistry {
  return {
    getActiveExpertRuntime: () => ({ ok: true, value: entry }),
    getExpertRuntimeByKeyAndVersion: (expertKey, expertVersion) => {
      if (options?.failLookup) {
        return expertRegistryError("expert_not_found", "registry unavailable", {
          expert_key: expertKey,
        });
      }
      if (
        expertKey === entry.definition.expert_key &&
        expertVersion === entry.definition.expert_version
      ) {
        return { ok: true, value: entry };
      }
      if (expertKey === entry.definition.expert_key) {
        return expertRegistryError("version_not_found", "version missing", {
          expert_key: expertKey,
          expert_version: expertVersion,
        });
      }
      return expertRegistryError("expert_not_found", "expert missing", {
        expert_key: expertKey,
      });
    },
    getExpertRuntimeByDefinitionHash: (definitionHash) => {
      if (options?.failLookup) {
        return expertRegistryError("definition_hash_not_found", "registry unavailable", {
          definition_hash: definitionHash,
        });
      }
      if (definitionHash === entry.definitionHash) {
        return { ok: true, value: entry };
      }
      return expertRegistryError("definition_hash_not_found", "hash missing", {
        definition_hash: definitionHash,
      });
    },
    listExpertRuntimeVersions: () => ({
      ok: true,
      value: [
        {
          expertKey: entry.definition.expert_key,
          expertVersion: entry.definition.expert_version,
          definitionHash: entry.definitionHash,
          lifecycleStatus: "active",
          enabled: entry.definition.enabled,
          registeredAt: entry.registeredAt,
          expertVersionId: options?.resolveVersionId ?? null,
        },
      ],
    }),
    existsExpertRuntime: () => ({ ok: true, value: true }),
    registerExpertRuntimeDefinition: () =>
      expertRegistryError("invalid_lookup", "read-only mock"),
    resolveExpertVersionId: () => ({
      ok: true,
      value: options?.resolveVersionId ?? null,
    }),
  };
}

describe("runExpertReview orchestrator shell (P2-20)", () => {
  beforeEach(() => {
    delete process.env[EXPERT_REVIEW_ENGINE_FLAG_NAME];
  });

  it("1. valid plan-only request produces deterministic plan", async () => {
    const registry = createMockRegistry();
    const request = baseRequest({ requestedCapabilities: ["commercial_analysis"] });
    const result = await runExpertReview(request, {
      registry,
      bypassFeatureFlag: true,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.plan.expertKey, "literary_agent");
    assert.equal(result.plan.expertVersion, LITERARY_AGENT_EXPERT_VERSION);
    assert.equal(result.plan.definitionHash, EXPECTED_LA_DEFINITION_HASH);
    assert.deepEqual(result.plan.requestedCapabilities, ["commercial_analysis"]);
  });

  it("2. executionPlanned is true for valid planning", async () => {
    const result = await runExpertReview(baseRequest(), {
      registry: createMockRegistry(),
      bypassFeatureFlag: true,
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.plan.executionPlanned, true);
  });

  it("3. executionAllowed is false", async () => {
    const result = await runExpertReview(baseRequest(), {
      registry: createMockRegistry(),
      bypassFeatureFlag: true,
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.plan.executionAllowed, false);
  });

  it("4. execute mode returns execution_mode_not_wired", async () => {
    const result = await runExpertReview(
      baseRequest({ executionMode: "execute" }),
      { registry: createMockRegistry(), bypassFeatureFlag: true },
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "execution_mode_not_wired");
      assert.match(result.message, /execute/);
    }
  });

  it("5. shadow mode returns execution_mode_not_wired", async () => {
    const result = await runExpertReview(
      baseRequest({ executionMode: "shadow" }),
      { registry: createMockRegistry(), bypassFeatureFlag: true },
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "execution_mode_not_wired");
  });

  it("6. feature flag absent means disabled", async () => {
    delete process.env[EXPERT_REVIEW_ENGINE_FLAG_NAME];
    const result = await runExpertReview(baseRequest(), {
      registry: createMockRegistry(),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "engine_disabled");
  });

  it("7. malformed feature flag means disabled", async () => {
    process.env[EXPERT_REVIEW_ENGINE_FLAG_NAME] = "maybe";
    assert.equal(readExpertReviewEngineEnabled(), false);
    const result = await runExpertReview(baseRequest(), {
      registry: createMockRegistry(),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "engine_disabled");
  });

  it("8. explicit injected bypass does not require environment flag", async () => {
    delete process.env[EXPERT_REVIEW_ENGINE_FLAG_NAME];
    const result = await runExpertReview(baseRequest(), {
      registry: createMockRegistry(),
      bypassFeatureFlag: true,
    });
    assert.equal(result.ok, true);
  });

  it("9. unknown expert returns typed error", async () => {
    const result = await runExpertReview(
      baseRequest({ expertKey: "missing_expert", expertVersion: "v1" }),
      { registry: createMockRegistry(), bypassFeatureFlag: true },
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "expert_not_found");
  });

  it("10. unknown version returns typed error", async () => {
    const result = await runExpertReview(
      baseRequest({ expertVersion: "v9.9.9-unknown" }),
      { registry: createMockRegistry(), bypassFeatureFlag: true },
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "version_not_found");
  });

  it("11. definition hash selector resolves exact version", async () => {
    const result = await runExpertReview(
      baseRequest({
        expertKey: undefined,
        expertVersion: undefined,
        definitionHash: EXPECTED_LA_DEFINITION_HASH,
      }),
      { registry: createMockRegistry(), bypassFeatureFlag: true },
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.plan.expertKey, "literary_agent");
      assert.equal(result.plan.expertVersion, LITERARY_AGENT_EXPERT_VERSION);
    }
  });

  it("12. conflicting selectors fail", async () => {
    const primary = mockLiteraryAgentEntry();
    const alternateDef = withRuntimeDefinitionHash({
      ...literaryAgentRuntimeDefinition(),
      expert_version: "v1.0.0-shadow",
    });
    const alternateHash = hashExpertRuntimeDefinition(alternateDef);
    const alternate = mockLiteraryAgentEntry({
      definition: alternateDef,
      definitionHash: alternateHash,
    });

    const conflictingRegistry: ExpertRuntimeRegistry = {
      ...createMockRegistry(primary),
      getExpertRuntimeByDefinitionHash: (definitionHash) => {
        if (definitionHash === alternateHash) {
          return { ok: true, value: alternate };
        }
        return expertRegistryError("definition_hash_not_found", "hash missing", {
          definition_hash: definitionHash,
        });
      },
    };

    const result = await runExpertReview(
      baseRequest({
        expertKey: "literary_agent",
        expertVersion: LITERARY_AGENT_EXPERT_VERSION,
        definitionHash: alternateHash,
      }),
      { registry: conflictingRegistry, bypassFeatureFlag: true },
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "selector_conflict");
  });

  it("13. duplicate capabilities are rejected", async () => {
    const result = await runExpertReview(
      baseRequest({
        requestedCapabilities: ["commercial_analysis", "commercial_analysis"],
      }),
      { registry: createMockRegistry(), bypassFeatureFlag: true },
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "invalid_request");
      assert.match(result.message, /Duplicate requested capability/);
    }
  });

  it("14. malformed capability fails", async () => {
    const result = await runExpertReview(
      baseRequest({
        requestedCapabilities: ["not_a_real_capability" as "commercial_analysis"],
      }),
      { registry: createMockRegistry(), bypassFeatureFlag: true },
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "invalid_request");
      assert.match(result.message, /Unknown requested capability/);
    }
  });

  it("15. request object is not mutated", async () => {
    const request = baseRequest({
      requestedCapabilities: ["publishing", "marketing"],
    });
    const snapshot = structuredClone(request);
    await runExpertReview(request, {
      registry: createMockRegistry(),
      bypassFeatureFlag: true,
    });
    assert.deepEqual(request, snapshot);
  });

  it("16. registry definition is not mutated", async () => {
    const entry = mockLiteraryAgentEntry();
    const definitionSnapshot = structuredClone(entry.definition);
    const hashBefore = entry.definitionHash;
    await runExpertReview(baseRequest(), {
      registry: createMockRegistry(entry),
      bypassFeatureFlag: true,
    });
    assert.deepEqual(entry.definition, definitionSnapshot);
    assert.equal(entry.definitionHash, hashBefore);
  });

  it("17. plan output is deeply immutable", async () => {
    const result = await runExpertReview(baseRequest(), {
      registry: createMockRegistry(),
      bypassFeatureFlag: true,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.throws(() => {
      (result.plan as { expertKey: string }).expertKey = "mutated";
    }, TypeError);
    assert.throws(() => {
      (result.plan.auditSnapshot as { engine_version: string }).engine_version = "mutated";
    }, TypeError);
  });

  it("18. repeated identical requests return identical plans", async () => {
    const registry = createMockRegistry();
    const request = baseRequest({ requestedCapabilities: ["marketing", "publishing"] });
    const first = await runExpertReview(request, { registry, bypassFeatureFlag: true });
    const second = await runExpertReview(request, { registry, bypassFeatureFlag: true });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (first.ok && second.ok) {
      assert.deepEqual(first.plan, second.plan);
    }
  });

  it("19. no dynamic module import occurs in orchestrator source", () => {
    assert.doesNotMatch(RUN_EXPERT_REVIEW_SOURCE, /\bimport\s*\(/);
    assert.doesNotMatch(RUN_EXPERT_REVIEW_SOURCE, /verifyAdvertisedModuleRefs/);
    assert.doesNotMatch(RUN_EXPERT_REVIEW_SOURCE, /collectAdvertisedModuleRefs/);
  });

  it("20. no exported expert function is invoked during planning", async () => {
    let exportProbeCalls = 0;
    const registry: ExpertRuntimeRegistry = {
      ...createMockRegistry(),
      getExpertRuntimeByKeyAndVersion: (...args) => {
        exportProbeCalls += 1;
        return createMockRegistry().getExpertRuntimeByKeyAndVersion(...args);
      },
    };
    const result = await runExpertReview(baseRequest(), {
      registry,
      bypassFeatureFlag: true,
    });
    assert.equal(result.ok, true);
    assert.equal(exportProbeCalls, 1);
  });

  it("21. no model call occurs during planning", async () => {
    const result = await runExpertReview(baseRequest(), {
      registry: createMockRegistry(),
      bypassFeatureFlag: true,
    });
    assert.equal(result.ok, true);
    assert.doesNotMatch(RUN_EXPERT_REVIEW_SOURCE, /anthropic|openai|generateText|invokeModel/);
  });

  it("22. Literary Agent may be planned by exact version via in-code adapter without executing", async () => {
    const result = await runExpertReview(
      {
        manuscriptId: MANUSCRIPT_ID,
        manuscriptVersionId: MANUSCRIPT_VERSION_ID,
        executionMode: "plan_only",
        expertKey: "literary_agent",
        expertVersion: LITERARY_AGENT_EXPERT_VERSION,
      },
      {
        registry: createInCodeExpertRuntimeRegistry(),
        bypassFeatureFlag: true,
      },
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.plan.definitionHash, EXPECTED_LA_DEFINITION_HASH);
      assert.equal(result.plan.executionAllowed, false);
      assert.ok(result.plan.auditSnapshot.constitution_definition_hash);
    }
  });

  it("23. certified production Literary Agent path remains untouched", async () => {
    const reviewEngineSource = readFileSync(
      join(ROOT, "lib/ai/review-engine.ts"),
      "utf8",
    );
    assert.doesNotMatch(reviewEngineSource, /runExpertReview/);
    assert.doesNotMatch(reviewEngineSource, /expert-review-engine\/run-expert-review/);

    const runtimeDef = literaryAgentRuntimeDefinition();
    assert.equal(hashExpertRuntimeDefinition(runtimeDef), EXPECTED_LA_DEFINITION_HASH);

    const staleEntry = mockLiteraryAgentEntry({
      definitionHash: "b".repeat(64),
    });
    const invalid = await runExpertReview(baseRequest(), {
      registry: createMockRegistry(staleEntry),
      bypassFeatureFlag: true,
    });
    assert.equal(invalid.ok, false);
    if (!invalid.ok) assert.equal(invalid.code, "runtime_definition_invalid");
  });
});

describe("runExpertReview additional validation", () => {
  it("rejects expert_key without exact version selector", async () => {
    const result = await runExpertReview(
      {
        manuscriptId: MANUSCRIPT_ID,
        manuscriptVersionId: MANUSCRIPT_VERSION_ID,
        executionMode: "plan_only",
        expertKey: "literary_agent",
      },
      { registry: createMockRegistry(), bypassFeatureFlag: true },
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "invalid_request");
  });

  it("maps registry lookup failure to registry_failure", async () => {
    const failingRegistry: ExpertRuntimeRegistry = {
      ...createMockRegistry(),
      getExpertRuntimeByKeyAndVersion: () =>
        expertRegistryError("invalid_lookup", "registry index unavailable"),
    };
    const result = await runExpertReview(baseRequest(), {
      registry: failingRegistry,
      bypassFeatureFlag: true,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "registry_failure");
  });

  it("rejects stale runtime definition content with runtime_definition_invalid", async () => {
    const tampered = withRuntimeDefinitionHash({
      ...literaryAgentRuntimeDefinition(),
      display_name: "Tampered display name for test",
    });
    const entry = mockLiteraryAgentEntry({
      definition: tampered,
      definitionHash: EXPECTED_LA_DEFINITION_HASH,
    });
    const result = await runExpertReview(baseRequest(), {
      registry: createMockRegistry(entry),
      bypassFeatureFlag: true,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "runtime_definition_invalid");
  });
});
