import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { estimatePhase2ASceneReviewBudget, PHASE2A_MAX_CONCURRENT_SCENES } from "./scene-review-budget.ts";

describe("phase 2A scene review budget", () => {
  it("estimates budget for 12 scenes within studio limit", () => {
    const est = estimatePhase2ASceneReviewBudget(12);
    assert.equal(est.selectedSceneCount, 12);
    assert.ok(est.totalReservationUsd <= 5.0);
    assert.equal(est.maxConcurrentScenes, PHASE2A_MAX_CONCURRENT_SCENES);
    assert.equal(est.model, "claude-haiku-4-5-20251001");
  });

  it("includes repair reserve", () => {
    const est = estimatePhase2ASceneReviewBudget(12);
    assert.ok(est.repairReserveUsd > 0);
    assert.ok(est.maxCalls >= 12);
  });
});
