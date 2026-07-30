import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  isMilitaryExpertV2AvailableInStudio,
  isMilitaryExpertV2SceneCentricEnabled,
  MILITARY_EXPERT_V2_SCENE_CENTRIC_FLAG_NAME,
} from "./military-expert-v2-feature-flag.ts";

const ENV_SNAPSHOT = { ...process.env };

afterEach(() => {
  process.env = { ...ENV_SNAPSHOT };
});

describe("military expert v2 feature flag", () => {
  it("defaults off without flag", () => {
    process.env.NODE_ENV = "development";
    process.env.STUDIO_ENABLED = "true";
    process.env.STUDIO_MILITARY_EXPERT_ENABLED = "1";
    delete process.env[MILITARY_EXPERT_V2_SCENE_CENTRIC_FLAG_NAME];
    assert.equal(isMilitaryExpertV2SceneCentricEnabled(), false);
    assert.equal(isMilitaryExpertV2AvailableInStudio(), false);
  });

  it("requires both local override and v2 flag", () => {
    process.env.NODE_ENV = "development";
    process.env.STUDIO_ENABLED = "true";
    process.env.STUDIO_MILITARY_EXPERT_ENABLED = "1";
    process.env[MILITARY_EXPERT_V2_SCENE_CENTRIC_FLAG_NAME] = "1";
    assert.equal(isMilitaryExpertV2SceneCentricEnabled(), true);
    assert.equal(isMilitaryExpertV2AvailableInStudio(), true);
  });

  it("never enables in production", () => {
    process.env.NODE_ENV = "production";
    process.env.STUDIO_MILITARY_EXPERT_ENABLED = "1";
    process.env[MILITARY_EXPERT_V2_SCENE_CENTRIC_FLAG_NAME] = "1";
    assert.equal(isMilitaryExpertV2SceneCentricEnabled(), false);
  });
});
