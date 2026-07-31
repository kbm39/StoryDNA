import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AUTHOR_INTENT_TYPES } from "./contract.ts";
import { validateAuthorIntentDraft } from "./validation.ts";
import {
  STUDIO_AUTHOR_INTENT_FLAG_NAME,
  isStudioAuthorIntentEnabled,
} from "./feature-flag.ts";

const BASE = {
  manuscript_id: "ms-1",
  manuscript_version_id: "ver-1",
  author_success_definition: "Ready for agent submission",
  created_by: "author-1",
};

describe("author intent validation", () => {
  for (const intentType of AUTHOR_INTENT_TYPES) {
    it(`validates intent type: ${intentType}`, () => {
      const result = validateAuthorIntentDraft({
        ...BASE,
        intent_type: intentType,
        custom_objective_text: intentType === "custom" ? "My custom goal" : null,
      });
      assert.equal(result.ok, true, `Expected ${intentType} to be valid`);
    });
  }

  it("requires custom text for custom intent", () => {
    const result = validateAuthorIntentDraft({
      ...BASE,
      intent_type: "custom",
      custom_objective_text: "",
    });
    assert.equal(result.ok, false);
    assert.match(result.errors[0].code, /custom_text_required/);
  });

  it("rejects requested/declined overlap", () => {
    const result = validateAuthorIntentDraft({
      ...BASE,
      intent_type: "query_preparation",
      requested_experts: ["literary_agent"],
      declined_experts: ["literary_agent"],
    });
    assert.equal(result.ok, false);
    assert.match(result.errors[0].code, /requested_declined_overlap/);
  });

  it("rejects unknown expert keys", () => {
    const result = validateAuthorIntentDraft({
      ...BASE,
      intent_type: "military_realism",
      requested_experts: ["fake_expert"],
    });
    assert.equal(result.ok, false);
    assert.match(result.errors[0].code, /unknown_requested_expert/);
  });

  it("rejects custom text on non-custom intent", () => {
    const result = validateAuthorIntentDraft({
      ...BASE,
      intent_type: "query_preparation",
      custom_objective_text: "Should not be here",
    });
    assert.equal(result.ok, false);
  });
});

describe("author intent feature flag", () => {
  const saved = process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME];
  const savedNodeEnv = process.env.NODE_ENV;

  it("defaults off", () => {
    delete process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME];
    process.env.NODE_ENV = "development";
    assert.equal(isStudioAuthorIntentEnabled(), false);
    if (saved === undefined) delete process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME];
    else process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME] = saved;
    process.env.NODE_ENV = savedNodeEnv;
  });

  it("is unavailable in production", () => {
    process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME] = "1";
    process.env.NODE_ENV = "production";
    assert.equal(isStudioAuthorIntentEnabled(), false);
    if (saved === undefined) delete process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME];
    else process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME] = saved;
    process.env.NODE_ENV = savedNodeEnv;
  });

  it("enables when flag is true in development", () => {
    process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME] = "true";
    process.env.NODE_ENV = "development";
    assert.equal(isStudioAuthorIntentEnabled(), true);
    if (saved === undefined) delete process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME];
    else process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME] = saved;
    process.env.NODE_ENV = savedNodeEnv;
  });
});
