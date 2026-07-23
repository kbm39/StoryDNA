import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { literaryAgentRuntimeDefinition } from "@/experts/literary-agent/runtime-definition.ts";
import { collectAdvertisedModuleRefs } from "./collect-module-refs.ts";
import { verifyAdvertisedModuleRefs } from "./verify-module-refs.ts";
import type { ExpertRuntimeDefinition } from "./types.ts";

function withPromptBuilderModule(
  moduleId: string,
): ExpertRuntimeDefinition {
  const base = literaryAgentRuntimeDefinition();
  return {
    ...base,
    prompt_builder: {
      ...base.prompt_builder,
      reviewerDefinitionModuleId: moduleId,
    },
  };
}

describe("verifyAdvertisedModuleRefs", () => {
  it("verifies all Literary Agent advertised refs", async () => {
    const result = await verifyAdvertisedModuleRefs(literaryAgentRuntimeDefinition());
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.refs.length, collectAdvertisedModuleRefs(literaryAgentRuntimeDefinition()).length);
    }
  });

  it("reports missing module with expert key and field path", async () => {
    const def = withPromptBuilderModule("@/lib/does-not-exist-module");
    const result = await verifyAdvertisedModuleRefs(def);
    assert.equal(result.ok, false);
    if (!result.ok) {
      const failure = result.failures.find((f) => f.moduleId === "@/lib/does-not-exist-module");
      assert.ok(failure);
      assert.equal(failure!.expertKey, "literary_agent");
      assert.ok(failure!.fieldPath.includes("prompt_builder"));
      assert.match(failure!.reason, /module_resolution_failed/);
    }
  });

  it("reports missing export", async () => {
    const def = literaryAgentRuntimeDefinition();
    const target = collectAdvertisedModuleRefs(def)[0]!;
    const result = await verifyAdvertisedModuleRefs(def, {
      importModule: async (moduleId) => {
        const mod = (await import(`${moduleId}.ts`)) as Record<string, unknown>;
        if (moduleId === target.moduleId) {
          const clone = { ...mod };
          delete clone[target.exportName];
          return clone;
        }
        return mod;
      },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      const failure = result.failures.find((f) => f.exportName === target.exportName);
      assert.ok(failure);
      assert.equal(failure!.expertKey, def.expert_key);
      assert.equal(failure!.fieldPath, target.fieldPath);
      assert.match(failure!.reason, /named_export_missing/);
    }
  });

  it("reports wrong export type", async () => {
    const def = literaryAgentRuntimeDefinition();
    const target = collectAdvertisedModuleRefs(def).find((r) => r.expectedExportKind === "function");
    assert.ok(target);
    const result = await verifyAdvertisedModuleRefs(def, {
      importModule: async (moduleId) => {
        const mod = (await import(`${moduleId}.ts`)) as Record<string, unknown>;
        if (moduleId === target!.moduleId) {
          return { ...mod, [target!.exportName]: "not-a-function" };
        }
        return mod;
      },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      const failure = result.failures.find((f) => f.exportName === target!.exportName);
      assert.ok(failure);
      assert.match(failure!.reason, /export_type_mismatch/);
    }
  });

  it("does not invoke exported functions during verification", async () => {
    const def = literaryAgentRuntimeDefinition();
    let invoked = false;
    const result = await verifyAdvertisedModuleRefs(def, {
      importModule: async (moduleId) => {
        const mod = (await import(`${moduleId}.ts`)) as Record<string, unknown>;
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
    });
    assert.equal(result.ok, true);
    assert.equal(invoked, false);
  });
});
