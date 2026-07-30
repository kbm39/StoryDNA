import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  estimatePhase2ASceneReviewBudget,
  PHASE2A_MAX_CONCURRENT_SCENES,
  PHASE2A_SCENE_REVIEW_HAIKU_MODEL,
  resolvePhase2ASceneReviewModelConfig,
} from "./scene-review-budget.ts";
import { ANTHROPIC_OPUS_48_MODEL_ID } from "@/lib/expert-calibration/live/provider-allowlist.ts";

describe("phase 2A scene review budget", () => {
  function withEnv(overrides: Record<string, string | undefined>, fn: () => void) {
    const keys = [
      "STUDIO_ENABLED",
      "STUDIO_MILITARY_EXPERT_ENABLED",
      "MILITARY_EXPERT_V2_SCENE_CENTRIC",
    ] as const;
    const prev: Record<string, string | undefined> = {};
    for (const key of keys) {
      prev[key] = process.env[key];
      if (overrides[key] === undefined) delete process.env[key];
      else process.env[key] = overrides[key];
    }
    try {
      fn();
    } finally {
      for (const key of keys) {
        if (prev[key] === undefined) delete process.env[key];
        else process.env[key] = prev[key];
      }
    }
  }

  it("estimates budget for 12 scenes within studio limit without V2 flags", () => {
    withEnv(
      {
        STUDIO_ENABLED: undefined,
        STUDIO_MILITARY_EXPERT_ENABLED: undefined,
        MILITARY_EXPERT_V2_SCENE_CENTRIC: undefined,
      },
      () => {
        const est = estimatePhase2ASceneReviewBudget(12);
        assert.equal(est.selectedSceneCount, 12);
        assert.ok(est.totalReservationUsd <= 5.0);
        assert.equal(est.maxConcurrentScenes, PHASE2A_MAX_CONCURRENT_SCENES);
        assert.equal(est.model, PHASE2A_SCENE_REVIEW_HAIKU_MODEL);
      },
    );
  });

  it("includes repair reserve", () => {
    withEnv(
      {
        STUDIO_ENABLED: undefined,
        STUDIO_MILITARY_EXPERT_ENABLED: undefined,
        MILITARY_EXPERT_V2_SCENE_CENTRIC: undefined,
      },
      () => {
        const est = estimatePhase2ASceneReviewBudget(12);
        assert.ok(est.repairReserveUsd > 0);
        assert.ok(est.maxCalls >= 12);
      },
    );
  });

  it("uses Opus when Kevin Studio V2 flags are enabled", () => {
    withEnv(
      {
        STUDIO_ENABLED: "true",
        STUDIO_MILITARY_EXPERT_ENABLED: "1",
        MILITARY_EXPERT_V2_SCENE_CENTRIC: "1",
      },
      () => {
        const config = resolvePhase2ASceneReviewModelConfig();
        assert.equal(config.model, ANTHROPIC_OPUS_48_MODEL_ID);
        const est = estimatePhase2ASceneReviewBudget(7);
        assert.equal(est.model, ANTHROPIC_OPUS_48_MODEL_ID);
        assert.ok(est.budgetLimitUsd >= 75);
      },
    );
  });
});
