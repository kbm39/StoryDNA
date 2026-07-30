import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assembleMilitaryExpertV2SynthesisInput } from "./synthesis-input.ts";
import type { MilitaryExpertSceneInventoryDocument } from "./contracts.ts";
import { MILITARY_EXPERT_SCENE_REVIEW_CONTRACT_VERSION } from "./scene-review-contract.ts";

const inventory: MilitaryExpertSceneInventoryDocument = {
  inventory_id: "inv_test",
  manuscript_id: "ms_test",
  manuscript_version_id: "mv_test",
  inventory_status: "ready_for_selection",
  scenes: [
    {
      scene_id: "ME-S-001",
      locator: {
        exact_page_number: null,
        page_is_approximate: true,
        chapter_label: "Chapter 1",
        scene_heading: null,
        approximate_book_percentage: 5,
        internal_start_offset: 100,
        internal_end_offset: 500,
      },
      scene_types: ["firefight"],
      action_categories: ["firefight_or_battle"],
      participants: ["Alpha"],
      priority_tier: "major",
      selection_rationale: "Major contact",
    },
  ],
  created_at: new Date().toISOString(),
  contract_version: "military_expert_scene_inventory@v1",
};

describe("synthesis input assembly", () => {
  it("assembles deterministic input from scene reviews", () => {
    const input = assembleMilitaryExpertV2SynthesisInput({
      inventory,
      selectedSceneIds: ["ME-S-001"],
      reviews: [
        {
          sceneReviewId: "sr_001",
          inventoryId: "inv_test",
          selectionSnapshotId: "snap_test",
          sceneId: "ME-S-001",
          manuscriptId: "ms_test",
          manuscriptVersionId: "mv_test",
          workflowId: "wf_test",
          reviewStatus: "complete",
          retryCount: 0,
          repairCount: 0,
          parsedReviewHash: "hash",
          errorCode: null,
          safeErrorMessage: null,
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          document: {
            contract_version: MILITARY_EXPERT_SCENE_REVIEW_CONTRACT_VERSION,
            scene_review_id: "sr_001",
            inventory_id: "inv_test",
            selection_snapshot_id: "snap_test",
            scene_id: "ME-S-001",
            manuscript_id: "ms_test",
            manuscript_version_id: "mv_test",
            workflow_id: "wf_test",
            locator: inventory.scenes[0]!.locator,
            scene_types: ["firefight"],
            action_categories: ["firefight_or_battle"],
            participants: ["Alpha"],
            review_status: "complete",
            authenticity_strengths: [],
            authenticity_concerns: [],
            supporting_evidence: [],
            contrary_evidence: [],
            safe_editorial_suggestions: [],
            realism_summary: "Readable contact sequence.",
            confidence: "medium",
            category_tags: ["firefight_or_battle"],
            provider_metadata: null,
            parsed_review_hash: "hash",
            retry_count: 0,
            repair_count: 0,
            created_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          },
        },
      ],
      coverage: {
        selectionSnapshotId: "snap_test",
        selectedCount: 1,
        terminalCount: 1,
        completeCount: 1,
        insufficientEvidenceCount: 0,
        outsideExpertiseCount: 0,
        failedCount: 0,
        queuedOrRunningCount: 0,
        coveragePercentage: 100,
        failedSceneIds: [],
        incompleteSceneIds: [],
        pass: true,
      },
    });

    assert.equal(input.scene_summaries.length, 1);
    assert.equal(input.scene_summaries[0]!.scene_id, "ME-S-001");
    assert.equal(input.input_version, "military_expert_v2_synthesis_input@v1");
  });
});
