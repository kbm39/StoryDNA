/**
 * Registry-wide dynamic import verification for advertised module references (P2-03).
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { literaryAgentRuntimeDefinition } from "@/experts/literary-agent/runtime-definition.ts";
import { collectAdvertisedModuleRefs } from "../collect-module-refs.ts";
import { verifyAdvertisedModuleRefs } from "../verify-module-refs.ts";
import {
  bootstrapExpertRuntimeRegistry,
  clearExpertRuntimeRegistryForTests,
  listExpertRuntimeDefinitions,
} from "./in-code.ts";

describe("registry-wide module ref parity — dynamic import", () => {
  beforeEach(() => {
    clearExpertRuntimeRegistryForTests();
    bootstrapExpertRuntimeRegistry();
  });

  it("verifies every registered expert runtime definition", async () => {
    const entries = listExpertRuntimeDefinitions({ includeDisabled: true });
    assert.ok(entries.length >= 1);

    for (const entry of entries) {
      const result = await verifyAdvertisedModuleRefs(entry.definition);
      if (!result.ok) {
        assert.fail(
          `module ref verification failed for ${entry.definition.expert_key}: ${result.failures.map((f) => `${f.fieldPath} ${f.reason}`).join("; ")}`,
        );
      }
    }
  });

  it("collects refs for every registered expert with stable provenance", () => {
    const entries = listExpertRuntimeDefinitions({ includeDisabled: true });
    for (const entry of entries) {
      const refs = collectAdvertisedModuleRefs(entry.definition);
      assert.ok(refs.length > 0, `expected refs for ${entry.definition.expert_key}`);
      assert.ok(refs.every((r) => r.expertKey === entry.definition.expert_key));
    }
  });
});

describe("Literary Agent runtime module ref parity — dynamic import", () => {
  const def = literaryAgentRuntimeDefinition();
  const refs = collectAdvertisedModuleRefs(def);

  it("collects every advertised module export reference for Literary Agent", () => {
    const logicalIds = refs.map((r) => r.logicalId);
    assert.deepEqual(def.normalization_plugins.map((p) => p.id), ["memo_statistics"]);
    assert.ok(logicalIds.includes("normalization:memo_statistics"));
    assert.ok(logicalIds.includes("validation:post_scoring_rubric"));
    assert.equal(logicalIds.some((id) => id.includes("narrow_broad")), false);
    assert.equal(logicalIds.some((id) => id.includes("rubric_against_gate")), false);
  });

  it("resolves every Literary Agent advertised ref via shared verifier", async () => {
    const result = await verifyAdvertisedModuleRefs(def);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.refs.length, refs.length);
      assert.deepEqual(
        result.refs.map((r) => r.fieldPath),
        refs.map((r) => r.fieldPath),
      );
    }
  });
});
