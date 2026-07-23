import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { literaryAgentRuntimeDefinition } from "@/experts/literary-agent/runtime-definition.ts";
import {
  validateExpertRuntimeDefinition,
  validateOptionalModuleExportPair,
} from "./validate-runtime-definition.ts";
import { withRuntimeDefinitionHash } from "./rehash-runtime-definition.ts";

describe("validateOptionalModuleExportPair", () => {
  it("accepts both absent", () => {
    assert.equal(validateOptionalModuleExportPair("rubric_definition", undefined, undefined), null);
  });

  it("accepts both present", () => {
    assert.equal(
      validateOptionalModuleExportPair("rubric_definition", "@/lib/foo", "buildFoo"),
      null,
    );
  });

  it("rejects module without export", () => {
    assert.match(
      validateOptionalModuleExportPair("rubric_definition", "@/lib/foo", undefined),
      /must both be set or both be absent/,
    );
  });

  it("rejects export without module", () => {
    assert.match(
      validateOptionalModuleExportPair("export_policy", undefined, "buildDocx"),
      /must both be set or both be absent/,
    );
  });
});

describe("validateExpertRuntimeDefinition optional module/export pairs", () => {
  it("accepts Literary Agent rubric and export pairs", () => {
    const result = validateExpertRuntimeDefinition(literaryAgentRuntimeDefinition());
    assert.equal(result.ok, true);
  });

  it("accepts rubric pair fully absent when kind is none", () => {
    const base = literaryAgentRuntimeDefinition();
    const def = withRuntimeDefinitionHash({
      ...base,
      rubric_definition: { kind: "none" },
    });
    const result = validateExpertRuntimeDefinition(def);
    assert.equal(result.ok, true);
  });

  it("rejects rubric module without export", () => {
    const base = literaryAgentRuntimeDefinition();
    const def = withRuntimeDefinitionHash({
      ...base,
      rubric_definition: {
        kind: "structured_json",
        moduleId: "@/lib/commercial-fiction-rubric",
      },
    });
    const result = validateExpertRuntimeDefinition(def);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes("rubric_definition")));
    }
  });

  it("rejects export_policy docx export without module", () => {
    const base = literaryAgentRuntimeDefinition();
    const def = withRuntimeDefinitionHash({
      ...base,
      export_policy: {
        ...base.export_policy,
        docxModuleId: undefined,
        docxExportName: "buildLiteraryAgentReviewDocx",
      },
    });
    const result = validateExpertRuntimeDefinition(def);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes("export_policy")));
    }
  });
});
