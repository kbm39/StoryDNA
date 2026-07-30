import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  estimateSceneReviewCost,
  estimateSelectionTotals,
  formatEstimatedCost,
  formatEstimatedRuntime,
  STUDIO_MILITARY_V2_SELECTION_BUDGET_USD,
} from "./estimator.ts";
import type { MilitaryExpertSceneInventoryEntry } from "./contracts.ts";

const sampleScene: MilitaryExpertSceneInventoryEntry = Object.freeze({
  inventory_id: "inv_test",
  scene_id: "ME-S-001",
  manuscript_id: "ms_test",
  manuscript_version_id: "mv_test",
  scene_index: 1,
  locator: Object.freeze({
    exact_page_number: null,
    page_is_approximate: false,
    chapter_label: null,
    scene_heading: null,
    approximate_book_percentage: 50,
    internal_start_offset: 0,
    internal_end_offset: 8000,
  }),
  two_sentence_description: "First. Second.",
  scene_types: ["firefight"],
  action_categories: ["firefight_or_battle"],
  participants: [],
  priority_tier: "major",
  discovery_confidence: 0.9,
  discovery_source: "deterministic_heuristic",
  default_selected: true,
  selection_warning_codes: [],
  source_hash: "hash",
});

describe("military expert v2 estimator", () => {
  it("estimates per-scene and selection totals", () => {
    const sceneEst = estimateSceneReviewCost(sampleScene);
    assert.ok(sceneEst.inputTokens > 0);
    assert.ok(sceneEst.costUsd >= 0);
    const totals = estimateSelectionTotals([sampleScene], new Set(["ME-S-001"]));
    assert.ok(totals.totalCostUsd >= sceneEst.costUsd);
    assert.ok(totals.runtimeMaxSeconds >= totals.runtimeMinSeconds);
  });

  it("formats cost and runtime copy", () => {
    assert.match(formatEstimatedCost(2.4), /^\$2\.40$/);
    assert.match(formatEstimatedRuntime(720, 1080), /approximately 12–18 minutes/);
  });

  it("flags budget exceeded for large selections", () => {
    const many = Array.from({ length: 200 }, (_, i) =>
      Object.freeze({
        ...sampleScene,
        scene_id: `ME-S-${String(i + 1).padStart(3, "0")}`,
        locator: Object.freeze({
          ...sampleScene.locator,
          internal_end_offset: 50000,
        }),
      }),
    );
    const ids = new Set(many.map((s) => s.scene_id));
    const totals = estimateSelectionTotals(many, ids);
    assert.ok(totals.totalCostUsd > STUDIO_MILITARY_V2_SELECTION_BUDGET_USD);
    assert.equal(totals.exceedsBudget, true);
  });
});
