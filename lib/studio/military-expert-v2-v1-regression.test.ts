import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { MILITARY_EXPERT_V2_SCENE_CENTRIC_FLAG_NAME } from "./military-expert-v2-feature-flag.ts";
import { isStudioMilitaryExpertLocalOverrideEnabled } from "./military-expert-local-policy.ts";

const ENV_SNAPSHOT = { ...process.env };

afterEach(() => {
  process.env = { ...ENV_SNAPSHOT };
});

describe("military expert v1 regression when v2 flag off", () => {
  it("v1 local override behavior unchanged when v2 flag absent", () => {
    process.env.NODE_ENV = "development";
    process.env.STUDIO_ENABLED = "true";
    process.env.STUDIO_MILITARY_EXPERT_ENABLED = "1";
    delete process.env[MILITARY_EXPERT_V2_SCENE_CENTRIC_FLAG_NAME];
    assert.equal(isStudioMilitaryExpertLocalOverrideEnabled(), true);
  });

  it("v1 local override still off in production regardless of v2", () => {
    process.env.NODE_ENV = "production";
    process.env.STUDIO_MILITARY_EXPERT_ENABLED = "1";
    process.env[MILITARY_EXPERT_V2_SCENE_CENTRIC_FLAG_NAME] = "1";
    assert.equal(isStudioMilitaryExpertLocalOverrideEnabled(), false);
  });
});
