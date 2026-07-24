import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { literaryAgentRuntimeDefinition } from "@/experts/literary-agent/runtime-definition.ts";
import { LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH } from "@/lib/expert-review-engine/literary-agent-constitution-hash.ts";
import { LITERARY_AGENT_EXPERT_VERSION } from "@/experts/literary-agent/runtime-definition.ts";
import { LITERARY_AGENT } from "@/lib/ai/review-engine.ts";
import {
  collectAdvertisedModuleRefs,
} from "./collect-module-refs.ts";
import {
  EXPERT_PLUGIN_EXECUTOR_FLAG_NAME,
  readExpertPluginExecutorEnabled,
} from "./feature-flags.ts";
import {
  EXPERT_MODULE_EXPORT_HANDLE,
  clearExpertModuleResolverCache,
  resolveExpertModuleReference,
  type ExpertModuleExportDescriptor,
} from "./module-resolver.ts";
import { runExpertReview } from "./run-expert-review.ts";
import { createInCodeExpertRuntimeRegistry } from "./registry/in-code-registry-adapter.ts";
import {
  executeResolvedExpertPlugin,
  EXPERT_MODULE_EXPORT_HANDLE as EXECUTOR_HANDLE,
  type ExpertPluginExecutionRequest,
} from "./plugin-executor.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const ENGINE_DIR = join(dirname(fileURLToPath(import.meta.url)));

const EXPECTED_LA_DEFINITION_HASH =
  "f4006eaa497dd1d821f30fdac33dcb4869eff68d1af46b1f7401a972020ca50b";
const EXPECTED_CONSTITUTION_HASH =
  "8f8b56a9de6c7d68f96fd7913645905ee2afb8ce7d0c066faba2c28106fe94f5";
const EXPECTED_REGISTRY_SEED_HASH =
  "f6b79bc07d7ba9630fb532c67c31c4b80bac2886002696e25290d163e4b44671";

const EXECUTOR_DEPS = { bypassFeatureFlag: true };
const RESOLVER_DEPS = { bypassFeatureFlag: true };

function productionSourceFiles(): string[] {
  const skipDirs = new Set([
    "node_modules",
    ".next",
    ".git",
    "lib/expert-review-engine",
  ]);
  const files: string[] = [];

  function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const rel = full.slice(ROOT.length + 1);
      if (skipDirs.has(rel) || rel.startsWith("lib/expert-review-engine/")) continue;
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
        files.push(full);
      }
    }
  }

  walk(ROOT);
  return files;
}

async function resolveLaExport(
  exportName: string,
  moduleId = "@/lib/canonical-review-input",
): Promise<ExpertModuleExportDescriptor> {
  const advertised = collectAdvertisedModuleRefs(literaryAgentRuntimeDefinition()).find(
    (r) => r.moduleId === moduleId && r.exportName === exportName,
  );
  assert.ok(advertised, `missing advertised ref for ${moduleId} ${exportName}`);
  const result = await resolveExpertModuleReference(
    {
      expertKey: advertised.expertKey,
      fieldPath: advertised.fieldPath,
      logicalId: advertised.logicalId,
      moduleId: advertised.moduleId,
      exportName: advertised.exportName,
      expectedExportKind: advertised.expectedExportKind,
    },
    RESOLVER_DEPS,
  );
  assert.equal(result.ok, true);
  return (result as Extract<typeof result, { ok: true }>).descriptor;
}

function baseCanonicalInputRequest(
  descriptor: ExpertModuleExportDescriptor,
  overrides: Partial<ExpertPluginExecutionRequest> = {},
): ExpertPluginExecutionRequest {
  return {
    descriptor,
    invocationKind: "validator",
    input: {
      args: {
        manuscriptVersionId: "msv-synthetic-001",
        extractedText: Array.from({ length: 50 }, () => "word").join(" "),
        storedWordCount: 50,
        contentHash: "synthetic-content-hash",
      },
    },
    context: { correlationId: "corr-test-001", auditId: "audit-test-001" },
    ...overrides,
  };
}

describe("executeResolvedExpertPlugin", () => {
  beforeEach(() => {
    clearExpertModuleResolverCache();
  });

  it("1. allowed pure function executes successfully", async () => {
    const descriptor = await resolveLaExport("buildCanonicalReviewInput");
    const result = await executeResolvedExpertPlugin(
      baseCanonicalInputRequest(descriptor),
      EXECUTOR_DEPS,
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.output.ok, true);
    }
  });

  it("2. result reports executionOccurred: true", async () => {
    const descriptor = await resolveLaExport("buildCanonicalReviewInput");
    const result = await executeResolvedExpertPlugin(
      baseCanonicalInputRequest(descriptor),
      EXECUTOR_DEPS,
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.executionOccurred, true);
      assert.equal(typeof result.durationMs, "number");
    }
  });

  it("3. resolver-produced opaque handle required", async () => {
    const descriptor = await resolveLaExport("buildCanonicalReviewInput");
    const descriptorRecord = descriptor as Record<string | symbol, unknown>;
    const { [EXPERT_MODULE_EXPORT_HANDLE]: omittedHandle, ...withoutHandle } = descriptorRecord;
    void omittedHandle;
    const result = await executeResolvedExpertPlugin(
      baseCanonicalInputRequest(withoutHandle as ExpertModuleExportDescriptor),
      EXECUTOR_DEPS,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "unresolved_export");
    }
  });

  it("4. arbitrary function input rejected", async () => {
    const result = await executeResolvedExpertPlugin(
      {
        descriptor: (() => "nope") as unknown as ExpertModuleExportDescriptor,
        invocationKind: "validator",
        input: { args: {} },
      },
      EXECUTOR_DEPS,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "invalid_execution_request");
    }
  });

  it("5. object export rejected", async () => {
    const advertised = collectAdvertisedModuleRefs(literaryAgentRuntimeDefinition()).find(
      (r) => r.exportName === "LITERARY_AGENT",
    )!;
    const result = await resolveExpertModuleReference(
      {
        expertKey: advertised.expertKey,
        fieldPath: advertised.fieldPath,
        logicalId: advertised.logicalId,
        moduleId: advertised.moduleId,
        exportName: advertised.exportName,
        expectedExportKind: "object",
      },
      RESOLVER_DEPS,
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      const execResult = await executeResolvedExpertPlugin(
        {
          descriptor: result.descriptor,
          invocationKind: "prompt_builder",
          input: { args: {} },
        },
        EXECUTOR_DEPS,
      );
      assert.equal(execResult.ok, false);
      if (!execResult.ok) {
        assert.equal(execResult.code, "export_not_callable");
      }
    }
  });

  it("6. unknown invocation kind rejected", async () => {
    const descriptor = await resolveLaExport("buildCanonicalReviewInput");
    const result = await executeResolvedExpertPlugin(
      {
        ...baseCanonicalInputRequest(descriptor),
        invocationKind: "unknown_kind" as "validator",
      },
      EXECUTOR_DEPS,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "invalid_execution_request");
    }
  });

  it("7. disallowed provider/model export rejected", async () => {
    const advertised = collectAdvertisedModuleRefs(literaryAgentRuntimeDefinition()).find(
      (r) => r.exportName === "repairCommercialMemoValidation",
    )!;
    const resolved = await resolveExpertModuleReference(
      {
        expertKey: advertised.expertKey,
        fieldPath: advertised.fieldPath,
        logicalId: advertised.logicalId,
        moduleId: advertised.moduleId,
        exportName: advertised.exportName,
        expectedExportKind: advertised.expectedExportKind,
      },
      RESOLVER_DEPS,
    );
    assert.equal(resolved.ok, true);
    if (resolved.ok) {
      const result = await executeResolvedExpertPlugin(
        {
          descriptor: resolved.descriptor,
          invocationKind: "validator",
          input: { args: { memoContent: "x", canonicalWordCount: 100 } },
        },
        EXECUTOR_DEPS,
      );
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.code, "unsafe_export_category");
      }
    }
  });

  it("8. disallowed repair function rejected", async () => {
    const descriptor = await resolveExpertModuleReference(
      {
        expertKey: "literary_agent",
        fieldPath: "repair_plugins[commercial_memo_repair].exportName",
        logicalId: "repair:commercial_memo_repair",
        moduleId: "@/lib/ai/anthropic",
        exportName: "repairCommercialMemoValidation",
        expectedExportKind: "function",
      },
      RESOLVER_DEPS,
    );
    assert.equal(descriptor.ok, true);
    if (descriptor.ok) {
      const result = await executeResolvedExpertPlugin(
        {
          descriptor: descriptor.descriptor,
          invocationKind: "validator",
          input: { args: { memoContent: "test", canonicalWordCount: 100 } },
        },
        EXECUTOR_DEPS,
      );
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.code, "unsafe_export_category");
      }
    }
  });

  it("9. disallowed publishing/export function rejected", async () => {
    const advertised = collectAdvertisedModuleRefs(literaryAgentRuntimeDefinition()).find(
      (r) => r.exportName === "buildLiteraryAgentReviewDocx",
    )!;
    const resolved = await resolveExpertModuleReference(
      {
        expertKey: advertised.expertKey,
        fieldPath: advertised.fieldPath,
        logicalId: advertised.logicalId,
        moduleId: advertised.moduleId,
        exportName: advertised.exportName,
        expectedExportKind: advertised.expectedExportKind,
      },
      RESOLVER_DEPS,
    );
    assert.equal(resolved.ok, true);
    if (resolved.ok) {
      const result = await executeResolvedExpertPlugin(
        {
          descriptor: resolved.descriptor,
          invocationKind: "payload_builder",
          input: { args: {} },
        },
        EXECUTOR_DEPS,
      );
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.code, "unsafe_export_category");
      }
    }
  });

  it("10. input contract validation", async () => {
    const descriptor = await resolveLaExport("buildCanonicalReviewInput");
    const result = await executeResolvedExpertPlugin(
      {
        descriptor,
        invocationKind: "validator",
        input: { args: { manuscriptVersionId: "x" } },
      },
      EXECUTOR_DEPS,
    );
    assert.equal(result.ok, true);
  });

  it("11. missing required input rejected", async () => {
    const descriptor = await resolveLaExport("buildCanonicalReviewInput");
    const result = await executeResolvedExpertPlugin(
      {
        descriptor,
        invocationKind: "validator",
        input: {},
      },
      EXECUTOR_DEPS,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "input_contract_invalid");
    }
  });

  it("12. forbidden field rejected", async () => {
    const descriptor = await resolveLaExport("buildCanonicalReviewInput");
    const result = await executeResolvedExpertPlugin(
      {
        descriptor,
        invocationKind: "validator",
        input: {
          args: { manuscriptVersionId: "x", extractedText: "word", storedWordCount: 1 },
          anthropicApiKey: "secret",
        },
      },
      EXECUTOR_DEPS,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "input_contract_invalid");
    }
  });

  it("13. input object not mutated", async () => {
    const descriptor = await resolveLaExport("buildCanonicalReviewInput");
    const input = {
      args: {
        manuscriptVersionId: "msv-synthetic-002",
        extractedText: "one two three four five",
        storedWordCount: 5,
      },
    };
    const frozenSnapshot = structuredClone(input);
    await executeResolvedExpertPlugin(
      { descriptor, invocationKind: "validator", input },
      EXECUTOR_DEPS,
    );
    assert.deepEqual(input, frozenSnapshot);
  });

  it("14. registry/runtime definition not mutated", async () => {
    const before = structuredClone(literaryAgentRuntimeDefinition());
    const beforeHash = before.runtime_versions.definition_hash;
    const descriptor = await resolveLaExport("buildCanonicalReviewInput");
    await executeResolvedExpertPlugin(baseCanonicalInputRequest(descriptor), EXECUTOR_DEPS);
    const after = literaryAgentRuntimeDefinition();
    assert.deepEqual(after.runtime_versions, before.runtime_versions);
    assert.equal(after.runtime_versions.definition_hash, beforeHash);
  });

  it("15. pure JSON result returned", async () => {
    const descriptor = await resolveLaExport("buildCanonicalReviewInput");
    const result = await executeResolvedExpertPlugin(
      baseCanonicalInputRequest(descriptor),
      EXECUTOR_DEPS,
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.doesNotThrow(() => JSON.stringify(result.output));
    }
  });

  it("16. function result rejected", async () => {
    const descriptor: ExpertModuleExportDescriptor = Object.freeze({
      expertKey: "test",
      fieldPath: "test",
      logicalId: "test",
      moduleId: "@/lib/canonical-review-input",
      exportName: "buildCanonicalReviewInput",
      exportKind: "function",
      [EXPERT_MODULE_EXPORT_HANDLE]: () => () => "nested",
    });
    const result = await executeResolvedExpertPlugin(
      baseCanonicalInputRequest(descriptor),
      EXECUTOR_DEPS,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "invocation_failed");
    }
  });

  it("17. symbol result rejected", async () => {
    const descriptor: ExpertModuleExportDescriptor = Object.freeze({
      expertKey: "test",
      fieldPath: "test",
      logicalId: "test",
      moduleId: "@/lib/canonical-review-input",
      exportName: "buildCanonicalReviewInput",
      exportKind: "function",
      [EXPERT_MODULE_EXPORT_HANDLE]: () => Symbol("bad"),
    });
    const result = await executeResolvedExpertPlugin(
      baseCanonicalInputRequest(descriptor),
      EXECUTOR_DEPS,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "invocation_failed");
    }
  });

  it("18. class-instance result rejected", async () => {
    class BadResult {
      value = 1;
    }
    const descriptor: ExpertModuleExportDescriptor = Object.freeze({
      expertKey: "test",
      fieldPath: "test",
      logicalId: "test",
      moduleId: "@/lib/canonical-review-input",
      exportName: "buildCanonicalReviewInput",
      exportKind: "function",
      [EXPERT_MODULE_EXPORT_HANDLE]: () => new BadResult(),
    });
    const result = await executeResolvedExpertPlugin(
      baseCanonicalInputRequest(descriptor),
      EXECUTOR_DEPS,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "invocation_failed");
    }
  });

  it("19. cyclic result rejected", async () => {
    const descriptor: ExpertModuleExportDescriptor = Object.freeze({
      expertKey: "test",
      fieldPath: "test",
      logicalId: "test",
      moduleId: "@/lib/canonical-review-input",
      exportName: "buildCanonicalReviewInput",
      exportKind: "function",
      [EXPERT_MODULE_EXPORT_HANDLE]: () => {
        const cycle: Record<string, unknown> = { a: 1 };
        cycle.self = cycle;
        return cycle;
      },
    });
    const result = await executeResolvedExpertPlugin(
      baseCanonicalInputRequest(descriptor),
      EXECUTOR_DEPS,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "invocation_failed");
    }
  });

  it("20. error stack not exposed", async () => {
    const descriptor: ExpertModuleExportDescriptor = Object.freeze({
      expertKey: "test",
      fieldPath: "test",
      logicalId: "test",
      moduleId: "@/lib/canonical-review-input",
      exportName: "buildCanonicalReviewInput",
      exportKind: "function",
      [EXPERT_MODULE_EXPORT_HANDLE]: () => {
        throw new Error("secret failure\n    at sensitive/path.ts:99:1");
      },
    });
    const result = await executeResolvedExpertPlugin(
      baseCanonicalInputRequest(descriptor),
      EXECUTOR_DEPS,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "invocation_failed");
      assert.equal(result.message, "secret failure");
      assert.doesNotMatch(JSON.stringify(result), /at sensitive/);
    }
  });

  it("21. invocation failure returns typed error", async () => {
    const descriptor: ExpertModuleExportDescriptor = Object.freeze({
      expertKey: "test",
      fieldPath: "test",
      logicalId: "test",
      moduleId: "@/lib/canonical-review-input",
      exportName: "buildCanonicalReviewInput",
      exportKind: "function",
      [EXPERT_MODULE_EXPORT_HANDLE]: () => {
        throw new Error("boom");
      },
    });
    const result = await executeResolvedExpertPlugin(
      baseCanonicalInputRequest(descriptor),
      EXECUTOR_DEPS,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "invocation_failed");
    }
  });

  it("22. timeout returns typed error", async () => {
    const descriptor: ExpertModuleExportDescriptor = Object.freeze({
      expertKey: "test",
      fieldPath: "test",
      logicalId: "test",
      moduleId: "@/lib/canonical-review-input",
      exportName: "buildCanonicalReviewInput",
      exportKind: "function",
      [EXPERT_MODULE_EXPORT_HANDLE]: () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ ok: true }), 500);
        }),
    });
    const result = await executeResolvedExpertPlugin(
      { ...baseCanonicalInputRequest(descriptor), timeoutMs: 25 },
      EXECUTOR_DEPS,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "timeout");
    }
  });

  it("23. abort returns typed error", async () => {
    const controller = new AbortController();
    const descriptor: ExpertModuleExportDescriptor = Object.freeze({
      expertKey: "test",
      fieldPath: "test",
      logicalId: "test",
      moduleId: "@/lib/canonical-review-input",
      exportName: "buildCanonicalReviewInput",
      exportKind: "function",
      [EXPERT_MODULE_EXPORT_HANDLE]: () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ ok: true }), 200);
        }),
    });
    controller.abort();
    const result = await executeResolvedExpertPlugin(
      { ...baseCanonicalInputRequest(descriptor), signal: controller.signal },
      EXECUTOR_DEPS,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "aborted");
    }
  });

  it("24. no retry occurs", async () => {
    let attempts = 0;
    const descriptor: ExpertModuleExportDescriptor = Object.freeze({
      expertKey: "test",
      fieldPath: "test",
      logicalId: "test",
      moduleId: "@/lib/canonical-review-input",
      exportName: "buildCanonicalReviewInput",
      exportKind: "function",
      [EXPERT_MODULE_EXPORT_HANDLE]: () => {
        attempts += 1;
        throw new Error("fail once");
      },
    });
    await executeResolvedExpertPlugin(baseCanonicalInputRequest(descriptor), EXECUTOR_DEPS);
    assert.equal(attempts, 1);
  });

  it("25. no background execution", () => {
    const source = readFileSync(join(ENGINE_DIR, "plugin-executor.ts"), "utf8");
    assert.doesNotMatch(source, /setImmediate/);
    assert.doesNotMatch(source, /queueMicrotask/);
    assert.doesNotMatch(source, /Worker\(/);
  });

  it("26. feature flag absent means disabled", async () => {
    const descriptor = await resolveLaExport("buildCanonicalReviewInput");
    const result = await executeResolvedExpertPlugin(baseCanonicalInputRequest(descriptor), {
      featureFlagReader: () => readExpertPluginExecutorEnabled({}),
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "executor_disabled");
    }
  });

  it("27. malformed feature flag means disabled", async () => {
    const descriptor = await resolveLaExport("buildCanonicalReviewInput");
    const result = await executeResolvedExpertPlugin(baseCanonicalInputRequest(descriptor), {
      featureFlagReader: () =>
        readExpertPluginExecutorEnabled({ [EXPERT_PLUGIN_EXECUTOR_FLAG_NAME]: "maybe" }),
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "executor_disabled");
    }
  });

  it("28. explicit test bypass works", async () => {
    const descriptor = await resolveLaExport("buildCanonicalReviewInput");
    const result = await executeResolvedExpertPlugin(baseCanonicalInputRequest(descriptor), {
      bypassFeatureFlag: true,
      featureFlagReader: () => false,
    });
    assert.equal(result.ok, true);
  });

  it("29. no model call occurs", () => {
    const source = readFileSync(join(ENGINE_DIR, "plugin-executor.ts"), "utf8");
    assert.doesNotMatch(source, /@anthropic-ai/);
    assert.doesNotMatch(source, /Anthropic/);
    assert.doesNotMatch(source, /openai/);
  });

  it("30. no Trigger call occurs", () => {
    const source = readFileSync(join(ENGINE_DIR, "plugin-executor.ts"), "utf8");
    assert.doesNotMatch(source, /@trigger\.dev/);
    assert.doesNotMatch(source, /trigger-client/);
  });

  it("31. no Supabase write occurs", () => {
    const source = readFileSync(join(ENGINE_DIR, "plugin-executor.ts"), "utf8");
    assert.doesNotMatch(source, /@supabase/);
    assert.doesNotMatch(source, /\.insert\(/);
    assert.doesNotMatch(source, /\.update\(/);
  });

  it("32. no file write occurs", async () => {
    const source = readFileSync(join(ENGINE_DIR, "plugin-executor.ts"), "utf8");
    assert.doesNotMatch(source, /writeFileSync/);
    assert.doesNotMatch(source, /createWriteStream/);

    const tempDir = mkdtempSync(join(tmpdir(), "p2-22-no-write-"));
    const probe = join(tempDir, "probe.txt");
    const descriptor = await resolveLaExport("buildCanonicalReviewInput");
    await executeResolvedExpertPlugin(baseCanonicalInputRequest(descriptor), EXECUTOR_DEPS);
    assert.throws(() => readFileSync(probe), /ENOENT/);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("33. no production caller imports executor", () => {
    const offenders: string[] = [];
    for (const file of productionSourceFiles()) {
      const content = readFileSync(file, "utf8");
      if (
        content.includes("plugin-executor") ||
        content.includes("executeResolvedExpertPlugin")
      ) {
        offenders.push(file.slice(ROOT.length + 1));
      }
    }
    assert.deepEqual(offenders, []);
  });

  it("34. runExpertReview remains unchanged", async () => {
    const runExpertReviewSource = readFileSync(
      join(ENGINE_DIR, "run-expert-review.ts"),
      "utf8",
    );
    assert.doesNotMatch(runExpertReviewSource, /plugin-executor/);
    assert.doesNotMatch(runExpertReviewSource, /executeResolvedExpertPlugin/);
    assert.match(runExpertReviewSource, /executionAllowed:\s*false/);

    const result = await runExpertReview(
      {
        manuscriptId: "ms-executor-test",
        manuscriptVersionId: "msv-executor-test",
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
  });

  it("35. executionAllowed remains false", async () => {
    const result = await runExpertReview(
      {
        manuscriptId: "ms-executor-test-2",
        manuscriptVersionId: "msv-executor-test-2",
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
      assert.equal(result.plan.executionAllowed, false);
    }
  });

  it("36. canonical hashes remain unchanged", () => {
    const def = literaryAgentRuntimeDefinition();
    assert.equal(def.runtime_versions.definition_hash, EXPECTED_LA_DEFINITION_HASH);
    assert.equal(def.runtime_versions.constitution_definition_hash, EXPECTED_CONSTITUTION_HASH);
    assert.equal(LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH, EXPECTED_CONSTITUTION_HASH);

    const registrySeedSource = readFileSync(
      join(ENGINE_DIR, "runtime-version-set.test.ts"),
      "utf8",
    );
    assert.ok(registrySeedSource.includes(EXPECTED_REGISTRY_SEED_HASH));
  });

  it("37. real deterministic Literary Agent export via resolver + executor", async () => {
    const descriptor = await resolveLaExport("buildCanonicalReviewInput");
    assert.ok(EXECUTOR_HANDLE in descriptor);
    const result = await executeResolvedExpertPlugin(
      baseCanonicalInputRequest(descriptor),
      EXECUTOR_DEPS,
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.provenance.exportName, "buildCanonicalReviewInput");
      assert.equal(result.invocationKind, "validator");
      assert.equal(result.executionOccurred, true);
      assert.equal((result.output as { ok: boolean }).ok, true);
    }
  });

  it("38. no real Literary Agent review workflow is executed", async () => {
    const descriptor = await resolveLaExport("buildSystemPrompt", "@/lib/ai/review-engine");
    const result = await executeResolvedExpertPlugin(
      {
        descriptor,
        invocationKind: "prompt_builder",
        input: { args: LITERARY_AGENT },
      },
      EXECUTOR_DEPS,
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(typeof result.output, "string");
      assert.ok((result.output as string).length > 0);
      assert.doesNotMatch(result.output as string, /STORYDNA_RUBRIC_JSON/);
    }

    const workflowSource = readFileSync(join(ENGINE_DIR, "plugin-executor.ts"), "utf8");
    assert.doesNotMatch(workflowSource, /from\s+["'].*run-expert-review/);
    assert.doesNotMatch(workflowSource, /await runExpertReview/);
    assert.doesNotMatch(workflowSource, /publish_commercial_review/);
  });
});

describe("executor feature flag contract", () => {
  it("readExpertPluginExecutorEnabled follows absent/off contract", () => {
    assert.equal(readExpertPluginExecutorEnabled({}), false);
    assert.equal(readExpertPluginExecutorEnabled({ [EXPERT_PLUGIN_EXECUTOR_FLAG_NAME]: "" }), false);
    assert.equal(readExpertPluginExecutorEnabled({ [EXPERT_PLUGIN_EXECUTOR_FLAG_NAME]: "true" }), true);
  });
});

describe("invocation kind mismatch", () => {
  beforeEach(() => {
    clearExpertModuleResolverCache();
  });

  it("rejects wrong invocation kind for allowlisted export", async () => {
    const descriptor = await resolveLaExport("buildCanonicalReviewInput");
    const result = await executeResolvedExpertPlugin(
      {
        ...baseCanonicalInputRequest(descriptor),
        invocationKind: "prompt_builder",
      },
      EXECUTOR_DEPS,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "invocation_kind_not_allowed");
    }
  });
});
