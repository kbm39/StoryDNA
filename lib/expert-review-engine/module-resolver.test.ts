import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { literaryAgentRuntimeDefinition } from "@/experts/literary-agent/runtime-definition.ts";
import { LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH } from "@/lib/expert-review-engine/literary-agent-constitution-hash.ts";
import {
  collectAdvertisedModuleRefs,
} from "./collect-module-refs.ts";
import {
  EXPERT_MODULE_IMPORTERS,
  approvedExpertModuleIds,
} from "./module-import-map.ts";
import {
  EXPERT_MODULE_EXPORT_HANDLE,
  clearExpertModuleResolverCache,
  preflightResolveExpertRuntimeModules,
  resolveExpertModuleReference,
  validateExpertModuleReferenceInput,
  type ExpertModuleReferenceInput,
  type ExpertModuleResolverDependencies,
} from "./module-resolver.ts";
import { runExpertReview } from "./run-expert-review.ts";
import { createInCodeExpertRuntimeRegistry } from "./registry/in-code-registry-adapter.ts";
import { LITERARY_AGENT_EXPERT_VERSION } from "@/experts/literary-agent/runtime-definition.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const ENGINE_DIR = join(dirname(fileURLToPath(import.meta.url)));

const EXPECTED_LA_DEFINITION_HASH =
  "f4006eaa497dd1d821f30fdac33dcb4869eff68d1af46b1f7401a972020ca50b";
const EXPECTED_CONSTITUTION_HASH =
  "8f8b56a9de6c7d68f96fd7913645905ee2afb8ce7d0c066faba2c28106fe94f5";
const EXPECTED_REGISTRY_SEED_HASH =
  "f6b79bc07d7ba9630fb532c67c31c4b80bac2886002696e25290d163e4b44671";

const RESOLVER_DEPS: ExpertModuleResolverDependencies = { bypassFeatureFlag: true };

function laRef(overrides: Partial<ExpertModuleReferenceInput> = {}): ExpertModuleReferenceInput {
  const reviewEngineRef = collectAdvertisedModuleRefs(literaryAgentRuntimeDefinition()).find(
    (r) => r.moduleId === "@/lib/ai/review-engine" && r.exportName === "buildSystemPrompt",
  )!;
  return {
    expertKey: reviewEngineRef.expertKey,
    fieldPath: reviewEngineRef.fieldPath,
    logicalId: reviewEngineRef.logicalId,
    moduleId: reviewEngineRef.moduleId,
    exportName: reviewEngineRef.exportName,
    expectedExportKind: reviewEngineRef.expectedExportKind,
    ...overrides,
  };
}

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

describe("module-import-map", () => {
  it("1. every approved Literary Agent module ID exists in the static import map", () => {
    const laModuleIds = [
      ...new Set(collectAdvertisedModuleRefs(literaryAgentRuntimeDefinition()).map((r) => r.moduleId)),
    ].sort();
    const mapIds = approvedExpertModuleIds();
    assert.deepEqual(mapIds, laModuleIds);
    for (const moduleId of laModuleIds) {
      assert.ok(Object.prototype.hasOwnProperty.call(EXPERT_MODULE_IMPORTERS, moduleId));
    }
  });
});

describe("resolveExpertModuleReference", () => {
  beforeEach(() => {
    clearExpertModuleResolverCache();
  });

  it("2. every advertised Literary Agent ref resolves successfully", async () => {
    const refs = collectAdvertisedModuleRefs(literaryAgentRuntimeDefinition());
    for (const ref of refs) {
      const result = await resolveExpertModuleReference(
        {
          expertKey: ref.expertKey,
          fieldPath: ref.fieldPath,
          logicalId: ref.logicalId,
          moduleId: ref.moduleId,
          exportName: ref.exportName,
          expectedExportKind: ref.expectedExportKind,
        },
        RESOLVER_DEPS,
      );
      assert.equal(result.ok, true, `failed for ${ref.fieldPath}`);
    }
  });

  it("3. named exports are verified on success", async () => {
    const ref = laRef({
      exportName: "LITERARY_AGENT",
      expectedExportKind: "object",
      fieldPath: "prompt_builder.reviewerDefinitionExport",
      logicalId: "prompt_builder.reviewer_definition",
    });
    const result = await resolveExpertModuleReference(ref, RESOLVER_DEPS);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.exportName, "LITERARY_AGENT");
      assert.equal(result.descriptor.exportName, "LITERARY_AGENT");
    }
  });

  it("4. expected export kinds are verified", async () => {
    const refs = collectAdvertisedModuleRefs(literaryAgentRuntimeDefinition());
    for (const advertised of refs) {
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
      if (result.ok) {
        assert.equal(result.actualExportKind, advertised.expectedExportKind);
      }
    }
  });

  it("5. exports are never invoked during resolution", async () => {
    let invoked = false;
    const importMap = {
      ...EXPERT_MODULE_IMPORTERS,
      "@/lib/ai/review-engine": async () => {
        const mod = (await EXPERT_MODULE_IMPORTERS["@/lib/ai/review-engine"]()) as Record<
          string,
          unknown
        >;
        const wrapped: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(mod)) {
          if (typeof value === "function") {
            wrapped[key] = (...args: unknown[]) => {
              invoked = true;
              return (value as (...a: unknown[]) => unknown)(...args);
            };
          } else {
            wrapped[key] = value;
          }
        }
        return wrapped;
      },
    };
    const refs = collectAdvertisedModuleRefs(literaryAgentRuntimeDefinition());
    for (const ref of refs) {
      const result = await resolveExpertModuleReference(
        {
          expertKey: ref.expertKey,
          fieldPath: ref.fieldPath,
          logicalId: ref.logicalId,
          moduleId: ref.moduleId,
          exportName: ref.exportName,
          expectedExportKind: ref.expectedExportKind,
        },
        { ...RESOLVER_DEPS, importMap, moduleNamespaceCache: new Map(), importPromiseCache: new Map() },
      );
      assert.equal(result.ok, true);
    }
    assert.equal(invoked, false);
  });

  it("6. relative path rejected", () => {
    const result = validateExpertModuleReferenceInput(laRef({ moduleId: "./lib/ai/review-engine" }));
    assert.ok(result);
    assert.equal(result!.code, "invalid_module_reference");
  });

  it("7. absolute path rejected", () => {
    const result = validateExpertModuleReferenceInput(
      laRef({ moduleId: "/tmp/storydna/lib/ai/review-engine" }),
    );
    assert.ok(result);
    assert.equal(result!.code, "invalid_module_reference");
  });

  it("8. path traversal rejected", () => {
    const result = validateExpertModuleReferenceInput(
      laRef({ moduleId: "@/lib/../secrets" }),
    );
    assert.ok(result);
    assert.equal(result!.code, "invalid_module_reference");
  });

  it("9. file URL rejected", () => {
    const result = validateExpertModuleReferenceInput(
      laRef({ moduleId: "file:///tmp/review-engine" }),
    );
    assert.ok(result);
    assert.equal(result!.code, "invalid_module_reference");
  });

  it("10. data URL rejected", () => {
    const result = validateExpertModuleReferenceInput(
      laRef({ moduleId: "data:text/javascript,export{}" }),
    );
    assert.ok(result);
    assert.equal(result!.code, "invalid_module_reference");
  });

  it("11. http/https URL rejected", () => {
    for (const moduleId of [
      "http://example.com/module",
      "https://example.com/module",
    ]) {
      const result = validateExpertModuleReferenceInput(laRef({ moduleId }));
      assert.ok(result);
      assert.equal(result!.code, "invalid_module_reference");
    }
  });

  it("12. node built-in rejected", () => {
    const result = validateExpertModuleReferenceInput(laRef({ moduleId: "node:fs" }));
    assert.ok(result);
    assert.equal(result!.code, "invalid_module_reference");
  });

  it("13. package-name import rejected", () => {
    const result = validateExpertModuleReferenceInput(laRef({ moduleId: "lodash" }));
    assert.ok(result);
    assert.equal(result!.code, "invalid_module_reference");
  });

  it("14. unknown internal alias rejected", () => {
    const result = validateExpertModuleReferenceInput(
      laRef({ moduleId: "@/lib/does-not-exist-module" }),
    );
    assert.ok(result);
    assert.equal(result!.code, "unsupported_module_namespace");
  });

  it("15. malformed export name rejected", () => {
    const result = validateExpertModuleReferenceInput(laRef({ exportName: "not-valid-name" }));
    assert.ok(result);
    assert.equal(result!.code, "invalid_module_reference");
  });

  it("16. missing named export returns typed error", async () => {
    const namespaceCache = new Map<string, Record<string, unknown>>();
    const importPromiseCache = new Map<string, Promise<Record<string, unknown>>>();
    namespaceCache.set("@/lib/ai/review-engine", {});
    const result = await resolveExpertModuleReference(laRef(), {
      ...RESOLVER_DEPS,
      moduleNamespaceCache: namespaceCache,
      importPromiseCache,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "named_export_missing");
      assert.equal(result.provenance.expertKey, "literary_agent");
    }
  });

  it("17. wrong export type returns typed error", async () => {
    const namespaceCache = new Map<string, Record<string, unknown>>();
    const importPromiseCache = new Map<string, Promise<Record<string, unknown>>>();
    namespaceCache.set("@/lib/ai/review-engine", { buildSystemPrompt: "not-a-function" });
    const result = await resolveExpertModuleReference(
      laRef({ exportName: "buildSystemPrompt", expectedExportKind: "function" }),
      {
        ...RESOLVER_DEPS,
        moduleNamespaceCache: namespaceCache,
        importPromiseCache,
      },
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "export_type_mismatch");
    }
  });

  it("18. module import failure returns typed error", async () => {
    const importMap = {
      ...EXPERT_MODULE_IMPORTERS,
      "@/lib/ai/review-engine": () => Promise.reject(new Error("import boom")),
    };
    const result = await resolveExpertModuleReference(laRef(), {
      ...RESOLVER_DEPS,
      importMap,
      moduleNamespaceCache: new Map(),
      importPromiseCache: new Map(),
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "module_resolution_failed");
      assert.match(result.message, /import failed/i);
    }
  });

  it("19. public diagnostics contain provenance", async () => {
    const ref = laRef();
    const success = await resolveExpertModuleReference(ref, RESOLVER_DEPS);
    assert.equal(success.ok, true);
    if (success.ok) {
      assert.equal(success.provenance.expertKey, ref.expertKey);
      assert.equal(success.provenance.fieldPath, ref.fieldPath);
      assert.equal(success.provenance.logicalId, ref.logicalId);
    }

    const failure = await resolveExpertModuleReference(
      laRef({ moduleId: "@/lib/unknown-module" }),
      RESOLVER_DEPS,
    );
    assert.equal(failure.ok, false);
    if (!failure.ok) {
      assert.equal(failure.provenance.expertKey, ref.expertKey);
      assert.equal(failure.provenance.fieldPath, ref.fieldPath);
    }
  });

  it("20. public diagnostics do not contain stack traces", async () => {
    const importMap = {
      ...EXPERT_MODULE_IMPORTERS,
      "@/lib/ai/review-engine": () =>
        Promise.reject(new Error("secret\n    at hiddenStackFrame (file.ts:1:1)")),
    };
    const result = await resolveExpertModuleReference(laRef(), {
      ...RESOLVER_DEPS,
      importMap,
      moduleNamespaceCache: new Map(),
      importPromiseCache: new Map(),
    });
    assert.equal(result.ok, false);
    const serialized = JSON.stringify(result);
    assert.doesNotMatch(serialized, /at hiddenStackFrame/);
    assert.doesNotMatch(serialized, /\n\s+at /);
  });

  it("21. repeated resolution uses cache", async () => {
    let importCount = 0;
    const importMap = {
      ...EXPERT_MODULE_IMPORTERS,
      "@/lib/ai/review-engine": () => {
        importCount += 1;
        return EXPERT_MODULE_IMPORTERS["@/lib/ai/review-engine"]();
      },
    };
    const deps: ExpertModuleResolverDependencies = {
      ...RESOLVER_DEPS,
      importMap,
      moduleNamespaceCache: new Map(),
      importPromiseCache: new Map(),
    };
    const ref = laRef();
    const first = await resolveExpertModuleReference(ref, deps);
    const second = await resolveExpertModuleReference(ref, deps);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(importCount, 1);
  });

  it("22. concurrent resolution deduplicates import", async () => {
    let importCount = 0;
    const importMap = {
      ...EXPERT_MODULE_IMPORTERS,
      "@/lib/ai/review-engine": () => {
        importCount += 1;
        return new Promise<Record<string, unknown>>((resolve) => {
          setTimeout(() => {
            void EXPERT_MODULE_IMPORTERS["@/lib/ai/review-engine"]().then((mod) =>
              resolve(mod as Record<string, unknown>),
            );
          }, 10);
        });
      },
    };
    const deps: ExpertModuleResolverDependencies = {
      ...RESOLVER_DEPS,
      importMap,
      moduleNamespaceCache: new Map(),
      importPromiseCache: new Map(),
    };
    const ref = laRef();
    const [a, b] = await Promise.all([
      resolveExpertModuleReference(ref, deps),
      resolveExpertModuleReference(ref, deps),
    ]);
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.equal(importCount, 1);
  });

  it("23. failed import is retryable", async () => {
    let attempts = 0;
    const importMap = {
      ...EXPERT_MODULE_IMPORTERS,
      "@/lib/ai/review-engine": () => {
        attempts += 1;
        if (attempts === 1) return Promise.reject(new Error("transient"));
        return EXPERT_MODULE_IMPORTERS["@/lib/ai/review-engine"]();
      },
    };
    const deps: ExpertModuleResolverDependencies = {
      ...RESOLVER_DEPS,
      importMap,
      moduleNamespaceCache: new Map(),
      importPromiseCache: new Map(),
    };
    const ref = laRef();
    const failed = await resolveExpertModuleReference(ref, deps);
    assert.equal(failed.ok, false);
    const succeeded = await resolveExpertModuleReference(ref, deps);
    assert.equal(succeeded.ok, true);
    assert.equal(attempts, 2);
  });

  it("24. cache can be cleared in tests", async () => {
    let importCount = 0;
    const importMap = {
      ...EXPERT_MODULE_IMPORTERS,
      "@/lib/ai/review-engine": () => {
        importCount += 1;
        return EXPERT_MODULE_IMPORTERS["@/lib/ai/review-engine"]();
      },
    };
    const namespaceCache = new Map<string, Record<string, unknown>>();
    const importPromiseCache = new Map<string, Promise<Record<string, unknown>>>();
    const deps: ExpertModuleResolverDependencies = {
      ...RESOLVER_DEPS,
      importMap,
      moduleNamespaceCache: namespaceCache,
      importPromiseCache,
    };
    const ref = laRef();
    await resolveExpertModuleReference(ref, deps);
    clearExpertModuleResolverCache(deps);
    await resolveExpertModuleReference(ref, deps);
    assert.equal(importCount, 2);
  });

  it("25. no export function is invoked (descriptor handle retained internally)", async () => {
    const ref = laRef({ exportName: "buildSystemPrompt", expectedExportKind: "function" });
    const result = await resolveExpertModuleReference(ref, RESOLVER_DEPS);
    assert.equal(result.ok, true);
    if (result.ok) {
      const handle = result.descriptor[EXPERT_MODULE_EXPORT_HANDLE];
      assert.equal(typeof handle, "function");
      const serialized = JSON.stringify(result, (_key, value) =>
        typeof value === "function" ? "[Function]" : value,
      );
      assert.doesNotMatch(serialized, /\[Function\]/);
    }
  });

  it("26. no model call occurs (preflight resolves without side effects)", async () => {
    const preflight = await preflightResolveExpertRuntimeModules(
      literaryAgentRuntimeDefinition(),
      RESOLVER_DEPS,
    );
    assert.equal(preflight.ok, true);
    assert.equal(
      preflight.resolvedCount,
      collectAdvertisedModuleRefs(literaryAgentRuntimeDefinition()).length,
    );
  });

  it("27. no Trigger call occurs (resolver source has no Trigger imports)", () => {
    const source = readFileSync(join(ENGINE_DIR, "module-resolver.ts"), "utf8");
    assert.doesNotMatch(source, /@trigger\.dev/);
    assert.doesNotMatch(source, /trigger-client/);
  });

  it("28. no production caller imports the resolver", () => {
    const offenders: string[] = [];
    for (const file of productionSourceFiles()) {
      const content = readFileSync(file, "utf8");
      if (
        content.includes("module-resolver") ||
        content.includes("resolveExpertModuleReference") ||
        content.includes("preflightResolveExpertRuntimeModules")
      ) {
        offenders.push(file.slice(ROOT.length + 1));
      }
    }
    assert.deepEqual(offenders, []);
  });

  it("29. runExpertReview remains unchanged and executionAllowed remains false", async () => {
    const runExpertReviewSource = readFileSync(
      join(ENGINE_DIR, "run-expert-review.ts"),
      "utf8",
    );
    assert.doesNotMatch(runExpertReviewSource, /module-resolver/);
    assert.doesNotMatch(runExpertReviewSource, /resolveExpertModuleReference/);
    assert.match(runExpertReviewSource, /executionAllowed:\s*false/);

    const result = await runExpertReview(
      {
        manuscriptId: "ms-resolver-test",
        manuscriptVersionId: "msv-resolver-test",
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

  it("30. canonical hashes remain unchanged", () => {
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
});

describe("preflightResolveExpertRuntimeModules", () => {
  beforeEach(() => {
    clearExpertModuleResolverCache();
  });

  it("preflights all Literary Agent refs with diagnostics only", async () => {
    const result = await preflightResolveExpertRuntimeModules(
      literaryAgentRuntimeDefinition(),
      RESOLVER_DEPS,
    );
    assert.equal(result.ok, true);
    assert.equal(
      result.resolvedCount,
      collectAdvertisedModuleRefs(literaryAgentRuntimeDefinition()).length,
    );
  });
});

describe("resolver feature flag", () => {
  it("returns resolver_disabled when flag is off and bypass is false", async () => {
    const result = await resolveExpertModuleReference(laRef(), {
      featureFlagReader: () => false,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "resolver_disabled");
    }
  });
});
