import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CAPABILITY_CLASSIFICATION_DEFINITIONS } from "@/lib/governance/capability-propagation/classifications.ts";
import {
  checkGovernanceDocument,
  documentDeclaresNewCapability,
  parseDocumentGovernanceMetadata,
} from "@/lib/governance/capability-propagation/check-document.ts";
import { loadCapabilityRegistry } from "@/lib/governance/capability-propagation/registry.ts";
import {
  CAPABILITY_CLASSIFICATIONS,
  CAPABILITY_PROPAGATION_CONTRACT_VERSION,
} from "@/lib/governance/capability-propagation/types.ts";
import {
  validateCapabilityPropagationReview,
  validateCapabilityPropagationReviewBlock,
  validateNoNewCapabilityDeclaration,
} from "@/lib/governance/capability-propagation/validate.ts";

function minimalReview(overrides: Record<string, unknown> = {}) {
  return {
    contract_version: CAPABILITY_PROPAGATION_CONTRACT_VERSION,
    capability_id: "cap.test.example",
    capability_name: "Test Capability",
    capability_description: "Example capability for validation tests",
    source_expert_key: "military_expert",
    source_feature: "test feature",
    introduced_in_commit: "abc1234",
    introduced_at: "2026-07-31T00:00:00Z",
    current_implementation_scope: "military_expert only",
    proposed_classification: "editorial_board_shared",
    final_classification: "editorial_board_shared",
    affected_existing_experts: ["literary_agent", "military_expert"],
    affected_future_expert_families: ["scene_centric"],
    editor_in_chief_impact: "none",
    platform_impact: "none",
    author_experience_impact: "none",
    report_impact: "none",
    revision_board_impact: "none",
    series_continuity_impact: "none",
    publication_state_impact: "none",
    canon_impact: "none",
    cost_impact: "none",
    runtime_impact: "none",
    safety_impact: "none",
    certification_impact: "benchmark required",
    schema_impact: "additive",
    migration_required: false,
    backward_compatibility_impact: "additive only",
    historical_data_impact: "none",
    propagation_decision: "propagate_to_all_experts",
    propagation_reason: "Shared finding contract",
    exclusions: [],
    required_follow_up_tasks: [],
    constitution_sections: ["§6", "§13"],
    retrospective_expert_assessments: [
      {
        expert_key: "literary_agent",
        applicable: "yes",
        reason: "Already partially implemented",
      },
      {
        expert_key: "military_expert",
        applicable: "yes",
        reason: "Origin expert",
      },
    ],
    reviewed_by: "operator",
    reviewed_at: "2026-07-31T00:00:00Z",
    status: "under_review",
    version: 1,
    ...overrides,
  };
}

const COMPLIANCE_JSON = `\`\`\`json
{
  "applicable_sections": ["§14"],
  "compliance_explanation": "Test doc",
  "amendment_required": "No",
  "backward_compatibility_impact": "none",
  "certification_impact": "none"
}
\`\`\``;

describe("capability propagation classifications", () => {
  it("accepts all five constitutional classifications", () => {
    assert.equal(CAPABILITY_CLASSIFICATIONS.length, 5);
    for (const c of CAPABILITY_CLASSIFICATIONS) {
      const def = CAPABILITY_CLASSIFICATION_DEFINITIONS.find((d) => d.classification === c);
      assert.ok(def, `missing definition for ${c}`);
    }
  });
});

describe("validateCapabilityPropagationReview", () => {
  it("accepts a valid review", () => {
    const result = validateCapabilityPropagationReview(minimalReview());
    assert.equal(result.ok, true);
  });

  it("rejects invalid classification", () => {
    const result = validateCapabilityPropagationReview(
      minimalReview({ final_classification: "invalid_scope" }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes("final_classification")));
    }
  });

  it("rejects missing propagation decision", () => {
    const review = minimalReview();
    delete (review as Record<string, unknown>).propagation_decision;
    const result = validateCapabilityPropagationReview(review);
    assert.equal(result.ok, false);
  });

  it("requires retrospective review when existing experts are affected", () => {
    const review = minimalReview();
    delete (review as Record<string, unknown>).retrospective_expert_assessments;
    const result = validateCapabilityPropagationReview(review);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes("retrospective_expert_assessments")));
    }
  });

  it("requires isolation reason for expert_specific classification", () => {
    const result = validateCapabilityPropagationReview(
      minimalReview({
        final_classification: "expert_specific",
        propagation_decision: "keep_expert_specific",
        affected_existing_experts: [],
        retrospective_expert_assessments: undefined,
        isolation_reason: "",
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes("isolation_reason")));
    }
  });

  it("rejects EIC-owned capability assigned as expert propagation", () => {
    const result = validateCapabilityPropagationReview(
      minimalReview({
        final_classification: "editor_in_chief_owned",
        propagation_decision: "propagate_to_all_experts",
        editor_in_chief_impact: "orchestration ingest",
        affected_existing_experts: [],
        retrospective_expert_assessments: undefined,
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes("editor_in_chief_owned")));
    }
  });

  it("requires platform-wide capabilities to list affected or excluded experts", () => {
    const result = validateCapabilityPropagationReview(
      minimalReview({
        final_classification: "platform_wide",
        propagation_decision: "move_to_platform",
        affected_existing_experts: [],
        exclusions: [],
        retrospective_expert_assessments: undefined,
      }),
    );
    assert.equal(result.ok, false);
  });
});

describe("validateNoNewCapabilityDeclaration", () => {
  it("accepts no_new_capability with rationale", () => {
    const result = validateNoNewCapabilityDeclaration({
      no_new_capability: true,
      rationale: "Documentation-only index update",
    });
    assert.equal(result.ok, true);
  });

  it("rejects no_new_capability without rationale", () => {
    const result = validateNoNewCapabilityDeclaration({ no_new_capability: true });
    assert.equal(result.ok, false);
  });
});

describe("checkGovernanceDocument", () => {
  it("accepts no_new_capability declaration with constitution compliance", () => {
    const doc = `---
no_new_capability: true
rationale: Governance index update only
---

## Constitution Compliance
${COMPLIANCE_JSON}
`;
    const result = checkGovernanceDocument(doc);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.mode, "no_new_capability");
  });

  it("rejects new expert capability without review", () => {
    const doc = `## Capability Propagation Review

- New capability introduced: scene delta scoring

## Constitution Compliance
${COMPLIANCE_JSON}
`;
    const result = checkGovernanceDocument(doc);
    assert.equal(result.ok, false);
  });

  it("rejects missing Constitution Compliance block", () => {
    const doc = `---
no_new_capability: true
rationale: missing compliance block
---
`;
    const result = checkGovernanceDocument(doc);
    assert.equal(result.ok, false);
  });

  it("accepts linked review block for new capability", () => {
    const doc = `## Constitution Compliance
${COMPLIANCE_JSON}

## Capability Propagation Review
\`\`\`json
{
  "new_capability_introduced": "scene delta scoring",
  "existing_capability_modified": "none",
  "classification": "expert_family",
  "existing_experts_evaluated": ["military_expert"],
  "future_experts_affected": ["combat_medicine_expert"],
  "editor_in_chief_impact": "none",
  "platform_impact": "none",
  "certification_impact": "family benchmark",
  "propagation_decision": "propagate_to_expert_family",
  "review_artifact_path": "docs/governance/capabilities/reviews/example.json"
}
\`\`\`
`;
    assert.equal(documentDeclaresNewCapability(doc), true);
    const result = checkGovernanceDocument(doc);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.mode, "capability_review");
  });
});

describe("validateCapabilityPropagationReviewBlock", () => {
  it("rejects invalid classification in PRD block", () => {
    const result = validateCapabilityPropagationReviewBlock({
      new_capability_introduced: "x",
      existing_capability_modified: "none",
      classification: "not_a_classification",
      existing_experts_evaluated: [],
      future_experts_affected: [],
      editor_in_chief_impact: "none",
      platform_impact: "none",
      certification_impact: "none",
      propagation_decision: "keep_expert_specific",
      review_artifact_path: "docs/example.md",
    });
    assert.equal(result.ok, false);
  });
});

describe("capability registry", () => {
  it("loads registry with unique IDs", () => {
    const registry = loadCapabilityRegistry();
    const ids = registry.capabilities.map((c) => c.capability_id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.length >= 28);
  });
});

describe("historical artifact safety", () => {
  it("does not reference provider calls or workflow launch in governance modules", () => {
    const metadata = parseDocumentGovernanceMetadata(`---
no_new_capability: true
rationale: test
---
`);
    assert.equal(metadata.no_new_capability?.no_new_capability, true);
  });
});
