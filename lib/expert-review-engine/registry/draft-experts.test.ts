import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bootstrapExpertRuntimeRegistry,
  clearExpertRuntimeRegistryForTests,
  getExpertRuntimeDefinition,
} from "./in-code.ts";
import { loadMilitaryExpertDraftRuntimeDefinition } from "./draft-experts.ts";

describe("draft expert runtime loaders", () => {
  it("loads and validates Military Expert draft runtime definition", () => {
    const definition = loadMilitaryExpertDraftRuntimeDefinition();
    assert.equal(definition.expert_key, "military_expert");
    assert.equal(definition.enabled, false);
    assert.equal(definition.expert_version, "v1.0.0-draft");
  });

  it("does not register Military Expert in production bootstrap", () => {
    clearExpertRuntimeRegistryForTests();
    bootstrapExpertRuntimeRegistry();
    assert.equal(getExpertRuntimeDefinition("military_expert"), null);
    assert.equal(getExpertRuntimeDefinition("military_expert", { includeDisabled: true }), null);
    assert.ok(getExpertRuntimeDefinition("literary_agent"));
  });
});
