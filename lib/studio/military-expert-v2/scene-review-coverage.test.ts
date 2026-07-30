import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeSceneReviewCoverage } from "./scene-review-coverage.ts";
import type { PersistedSceneReviewRow } from "./scene-review-persistence.ts";

const selected = ["ME-S-001", "ME-S-002", "ME-S-008"];

function mockReview(
  sceneId: string,
  status: PersistedSceneReviewRow["reviewStatus"],
): PersistedSceneReviewRow {
  return Object.freeze({
    sceneReviewId: `sr_${sceneId}`,
    inventoryId: "inv_test",
    selectionSnapshotId: "snap_test",
    sceneId,
    manuscriptId: "ms_test",
    manuscriptVersionId: "mv_test",
    workflowId: "wf_test",
    reviewStatus: status,
    retryCount: 0,
    repairCount: 0,
    parsedReviewHash: null,
    errorCode: null,
    safeErrorMessage: null,
    createdAt: new Date().toISOString(),
    completedAt: status === "complete" ? new Date().toISOString() : null,
    document: null,
  });
}

describe("scene review coverage", () => {
  it("requires 100% terminal coverage with zero failures", () => {
    const metrics = computeSceneReviewCoverage(selected, [
      mockReview("ME-S-001", "complete"),
      mockReview("ME-S-002", "insufficient_evidence"),
      mockReview("ME-S-008", "outside_expertise"),
    ]);
    assert.equal(metrics.coveragePercentage, 100);
    assert.equal(metrics.failedCount, 0);
    assert.ok(metrics.pass);
  });

  it("fails when a scene is failed or incomplete", () => {
    const metrics = computeSceneReviewCoverage(selected, [
      mockReview("ME-S-001", "complete"),
      mockReview("ME-S-002", "failed"),
    ]);
    assert.ok(!metrics.pass);
    assert.ok(metrics.failedSceneIds.includes("ME-S-002"));
    assert.ok(metrics.incompleteSceneIds.includes("ME-S-008"));
  });
});
