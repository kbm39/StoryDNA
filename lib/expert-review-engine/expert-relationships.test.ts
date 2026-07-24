import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { literaryAgentRuntimeDefinition } from "@/experts/literary-agent/runtime-definition.ts";
import {
  getCompatibleExperts,
  getEscalationExperts,
  validateEditorInChiefRelationshipRules,
} from "./expert-relationships.ts";
import { withRuntimeDefinitionHash } from "./rehash-runtime-definition.ts";
import { validateExpertRuntimeDefinition } from "./validate-runtime-definition.ts";

describe("expert relationship single source of truth", () => {
  it("Literary Agent uses editor_in_chief_rules as the authoritative relationship source", () => {
    const def = literaryAgentRuntimeDefinition();
    assert.deepEqual(getCompatibleExperts(def), ["developmental_editor", "line_editor"]);
    assert.deepEqual(getEscalationExperts(def), ["developmental_editor"]);
    assert.deepEqual(def.editor_in_chief_rules.compatibleExperts, getCompatibleExperts(def));
    assert.deepEqual(def.editor_in_chief_rules.escalationExperts, getEscalationExperts(def));
    assert.equal("compatible_experts" in def, false);
    assert.equal("escalation_experts" in def, false);
  });

  it("accepts Literary Agent relationship contract via registry validation", () => {
    const result = validateExpertRuntimeDefinition(literaryAgentRuntimeDefinition());
    assert.equal(result.ok, true);
  });

  it("rejects duplicate compatible expert keys", () => {
    const base = literaryAgentRuntimeDefinition();
    const def = withRuntimeDefinitionHash({
      ...base,
      editor_in_chief_rules: {
        ...base.editor_in_chief_rules,
        compatibleExperts: ["developmental_editor", "developmental_editor"],
      },
    });
    const result = validateExpertRuntimeDefinition(def);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes("duplicate expert key")));
    }
  });

  it("rejects self-reference in escalation experts", () => {
    const base = literaryAgentRuntimeDefinition();
    const def = withRuntimeDefinitionHash({
      ...base,
      editor_in_chief_rules: {
        ...base.editor_in_chief_rules,
        escalationExperts: ["literary_agent"],
      },
    });
    const result = validateExpertRuntimeDefinition(def);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes("cannot reference itself")));
    }
  });

  it("rejects unsorted relationship keys", () => {
    const errors = validateEditorInChiefRelationshipRules("literary_agent", {
      compatibleExperts: ["line_editor", "developmental_editor"],
      escalationExperts: ["developmental_editor"],
      prerequisiteExperts: [],
      duplicateReviewPolicy: "block_same_expert_same_version",
    });
    assert.ok(errors.some((e) => e.includes("lexicographic order")));
  });

  it("rejects malformed relationship expert keys", () => {
    const errors = validateEditorInChiefRelationshipRules("literary_agent", {
      compatibleExperts: ["Bad-Key"],
      escalationExperts: [],
      prerequisiteExperts: [],
      duplicateReviewPolicy: "block_same_expert_same_version",
    });
    assert.ok(errors.some((e) => e.includes("malformed expert key")));
  });

  it("allows syntactically valid but unregistered relationship keys", () => {
    const base = literaryAgentRuntimeDefinition();
    const def = withRuntimeDefinitionHash({
      ...base,
      editor_in_chief_rules: {
        ...base.editor_in_chief_rules,
        compatibleExperts: ["developmental_editor", "future_expert"],
      },
    });
    const result = validateExpertRuntimeDefinition(def);
    assert.equal(result.ok, true);
  });
});
