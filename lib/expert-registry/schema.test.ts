import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateExpertDefinition, evidenceOverrideWeakensBaseline, validateExpertScope } from "./schema.ts";
import { minimalValidExpertDefinition } from "./test-fixtures.ts";

describe("expert-registry schema", () => {
  it("accepts a valid expert definition", () => {
    const result = validateExpertDefinition(minimalValidExpertDefinition());
    assert.equal(result.ok, true);
  });

  it("rejects missing professional_standards", () => {
    const def = minimalValidExpertDefinition();
    const copy = { ...def };
    delete (copy as { professional_standards?: unknown }).professional_standards;
    const result = validateExpertDefinition(copy);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes("professional_standards")));
    }
  });

  it("rejects missing evidence_policy", () => {
    const def = minimalValidExpertDefinition();
    const copy = { ...def };
    delete (copy as { evidence_policy?: unknown }).evidence_policy;
    const result = validateExpertDefinition(copy);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes("evidence_policy")));
    }
  });

  it("rejects unknown evidence profile", () => {
    const def = minimalValidExpertDefinition({
      evidence_policy: {
        ...minimalValidExpertDefinition().evidence_policy,
        profile_refs: ["NONEXISTENT_PROFILE"],
      },
    });
    const result = validateExpertDefinition(def);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes("Unknown evidence profile")));
    }
  });

  it("rejects invalid scope via validateExpertScope", () => {
    assert.equal(validateExpertScope("platform"), true);
    assert.equal(validateExpertScope("invalid_scope"), false);
  });

  it("rejects invalid category", () => {
    const def = minimalValidExpertDefinition({
      identity: {
        ...minimalValidExpertDefinition().identity,
        category: "invalid_category" as never,
      },
    });
    const result = validateExpertDefinition(def);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes("Unknown category")));
    }
  });

  it("rejects zero evidence for material finding", () => {
    const def = minimalValidExpertDefinition({
      evidence_policy: {
        ...minimalValidExpertDefinition().evidence_policy,
        per_output_requirements: [
          {
            output_type: "conclusion",
            minimum_records: 0,
            required_fields: ["claim"],
            allowed_types: ["MANUSCRIPT"],
          },
        ],
      },
    });
    const result = validateExpertDefinition(def);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes("minimum_records")));
    }
  });

  it("rejects evidence override that weakens profile baseline", () => {
    const errors = evidenceOverrideWeakensBaseline("EDITORIAL", {
      stricter_minimum_records: { material_criticism: 0 },
    });
    assert.ok(errors.length > 0);
  });

  it("accepts valid stricter override", () => {
    const def = minimalValidExpertDefinition({
      evidence_policy: {
        ...minimalValidExpertDefinition().evidence_policy,
        profile_refs: ["EDITORIAL"],
        expert_specific_overrides: {
          stricter_minimum_records: { material_criticism: 2 },
        },
      },
    });
    const result = validateExpertDefinition(def);
    assert.equal(result.ok, true);
  });

  it("rejects manuscript text embedded in definition", () => {
    const longText = "chapter ".repeat(100) + "she said he said ".repeat(50);
    const def = minimalValidExpertDefinition({
      purpose: {
        ...minimalValidExpertDefinition().purpose,
        mission: longText,
      },
    });
    const result = validateExpertDefinition(def);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes("manuscript text")));
    }
  });

  it("rejects secret-like fields", () => {
    const def = {
      ...minimalValidExpertDefinition(),
      api_key: "sk-abcdefghijklmnopqrstuvwxyz1234567890",
    };
    const result = validateExpertDefinition(def);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes("Secret") || e.includes("secret")));
    }
  });

  it("rejects provider_specific_config", () => {
    const def = {
      ...minimalValidExpertDefinition(),
      execution_profile: {
        ...minimalValidExpertDefinition().execution_profile,
        provider_specific_config: { anthropic: { model: "claude" } },
      },
    };
    const result = validateExpertDefinition(def);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes("provider_specific_config")));
    }
  });

  it("rejects invalid lifecycle_status", () => {
    const def = minimalValidExpertDefinition({
      versioning: {
        version: "v1",
        lifecycle_status: "published" as never,
      },
    });
    const result = validateExpertDefinition(def);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes("lifecycle_status")));
    }
  });

  it("rejects empty professional_standards.principles", () => {
    const def = minimalValidExpertDefinition({
      professional_standards: {
        ...minimalValidExpertDefinition().professional_standards,
        principles: [],
      },
    });
    const result = validateExpertDefinition(def);
    assert.equal(result.ok, false);
  });

  it("rejects missing competencies", () => {
    const def = minimalValidExpertDefinition({
      knowledge: {
        ...minimalValidExpertDefinition().knowledge,
        competencies: [],
      },
    });
    const result = validateExpertDefinition(def);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes("competencies")));
    }
  });

  it("rejects invalid domain_confidence percent", () => {
    const def = minimalValidExpertDefinition({
      knowledge: {
        ...minimalValidExpertDefinition().knowledge,
        domain_confidence: [{ domain: "Test", confidence_percent: 150 }],
      },
    });
    const result = validateExpertDefinition(def);
    assert.equal(result.ok, false);
  });
});
