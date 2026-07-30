import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  estimatePhase2BSynthesisBudget,
  resolvePhase2BSynthesisModelConfig,
} from "./synthesis-budget.ts";

describe("phase 2B synthesis budget", () => {
  it("uses opus model config when v2 flags enabled", () => {
    const prevStudio = process.env.STUDIO_MILITARY_EXPERT_ENABLED;
    const prevV2 = process.env.MILITARY_EXPERT_V2_SCENE_CENTRIC;
    process.env.STUDIO_MILITARY_EXPERT_ENABLED = "1";
    process.env.MILITARY_EXPERT_V2_SCENE_CENTRIC = "1";

    try {
      const config = resolvePhase2BSynthesisModelConfig();
      assert.match(config.model, /opus/i);
      const estimate = estimatePhase2BSynthesisBudget();
      assert.equal(estimate.provider, "anthropic");
      assert.ok(estimate.totalReservationUsd > 0);
    } finally {
      process.env.STUDIO_MILITARY_EXPERT_ENABLED = prevStudio;
      process.env.MILITARY_EXPERT_V2_SCENE_CENTRIC = prevV2;
    }
  });
});
