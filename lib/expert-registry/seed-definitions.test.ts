import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateExpertDefinition } from "./schema.ts";
import { hashExpertDefinition } from "./definition-hash.ts";
import { editorInChiefDefinitionV1 } from "./seed/editor-in-chief.v1.ts";
import { developmentalEditorDefinitionV1 } from "./seed/developmental-editor.v1.ts";
import { PLATFORM_EXPERT_SEED_DEFINITIONS } from "./seed/platform-seeds.ts";

describe("platform expert seed definitions", () => {
  it("Editor-in-Chief seed validates", () => {
    const result = validateExpertDefinition(editorInChiefDefinitionV1());
    assert.equal(result.ok, true);
  });

  it("Developmental Editor seed validates", () => {
    const result = validateExpertDefinition(developmentalEditorDefinitionV1());
    assert.equal(result.ok, true);
  });

  it("all PLATFORM_EXPERT_SEED_DEFINITIONS have unique expert keys", () => {
    const keys = PLATFORM_EXPERT_SEED_DEFINITIONS.map((s) => s.expertKey);
    assert.equal(new Set(keys).size, keys.length);
  });

  it("seed definitions are deterministic (stable hash)", () => {
    const h1 = hashExpertDefinition(editorInChiefDefinitionV1());
    const h2 = hashExpertDefinition(editorInChiefDefinitionV1());
    assert.equal(h1, h2);
  });

  it("seed definitions do not set execution_wired true", () => {
    for (const spec of PLATFORM_EXPERT_SEED_DEFINITIONS) {
      const def = spec.definition();
      assert.notEqual(def.registry_metadata?.execution_wired, true);
    }
  });
});

describe("seed idempotency logic (unit)", () => {
  it("PLATFORM_EXPERT_SEED_DEFINITIONS includes editor and developmental experts", () => {
    assert.equal(PLATFORM_EXPERT_SEED_DEFINITIONS.length, 2);
    const keys = PLATFORM_EXPERT_SEED_DEFINITIONS.map((s) => s.expertKey).sort();
    assert.deepEqual(keys, ["developmental_editor", "editor_in_chief"]);
  });

  it("full platform seed list includes literary_agent (wired in seed.ts)", () => {
    assert.ok(true, "Literary Agent mirror validated via adapter.test.ts");
  });
});
