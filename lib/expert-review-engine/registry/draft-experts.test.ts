import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bootstrapExpertRuntimeRegistry,
  clearExpertRuntimeRegistryForTests,
  getExpertRuntimeDefinition,
} from "./in-code.ts";
import {
  loadArchivistDraftRuntimeDefinition,
  loadMilitaryExpertDraftRuntimeDefinition,
} from "./draft-experts.ts";

describe("draft expert runtime loaders", () => {
  it("loads and validates Military Expert draft runtime definition", () => {
    const definition = loadMilitaryExpertDraftRuntimeDefinition();
    assert.equal(definition.expert_key, "military_expert");
    assert.equal(definition.enabled, false);
    assert.equal(definition.expert_version, "v1.0.0-draft");
  });

  it("loads and validates Archivist draft runtime definition", () => {
    const definition = loadArchivistDraftRuntimeDefinition();
    assert.equal(definition.expert_key, "archivist");
    assert.equal(definition.enabled, false);
    assert.equal(definition.expert_version, "v1.0.0-draft");
    assert.equal(definition.manuscript_scope, "full_manuscript");
    assert.equal(definition.series_scope, "optional");
  });

  it("does not register Military Expert or Archivist in production bootstrap", () => {
    clearExpertRuntimeRegistryForTests();
    bootstrapExpertRuntimeRegistry();
    assert.equal(getExpertRuntimeDefinition("military_expert"), null);
    assert.equal(getExpertRuntimeDefinition("military_expert", { includeDisabled: true }), null);
    assert.equal(getExpertRuntimeDefinition("archivist"), null);
    assert.equal(getExpertRuntimeDefinition("archivist", { includeDisabled: true }), null);
    assert.ok(getExpertRuntimeDefinition("literary_agent"));
  });
});
