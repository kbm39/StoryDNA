import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { getExpertCatalogEntry } from "@/lib/expert-catalog.ts";
import {
  STUDIO_MILITARY_EXPERT_LAUNCH_ACK,
  isMilitaryExpertLaunchableInLocalStudio,
  isMilitaryExpertRecruitableInLocalStudio,
  isStudioMilitaryExpertLocalOverrideEnabled,
  validateMilitaryExpertLaunchAckToken,
} from "./military-expert-local-policy.ts";
import { militaryExpertStudioVerdict } from "./expert-classification.ts";
import { isExpertLaunchableInStudio } from "./expert-classification.ts";

const ENV_SNAPSHOT = { ...process.env };

afterEach(() => {
  process.env = { ...ENV_SNAPSHOT };
});

function enableLocalMilitaryEnv(): void {
  process.env.NODE_ENV = "development";
  process.env.STUDIO_ENABLED = "true";
  process.env.STUDIO_MILITARY_EXPERT_ENABLED = "1";
}

describe("Military Expert local Studio policy", () => {
  it("1. Military Expert remains globally disabled in catalog", () => {
    const entry = getExpertCatalogEntry("military_expert")!;
    assert.equal(entry.selectionEnabled, false);
    assert.notEqual(entry.certificationStatus, "certified");
    assert.equal(entry.availability, "coming_soon");
  });

  it("2. production cannot enable local override", () => {
    process.env.NODE_ENV = "production";
    process.env.STUDIO_ENABLED = "true";
    process.env.STUDIO_MILITARY_EXPERT_ENABLED = "1";
    assert.equal(isStudioMilitaryExpertLocalOverrideEnabled(), false);
    assert.equal(militaryExpertStudioVerdict(), "MILITARY_STUDIO_BLOCKED");
  });

  it("3. development without flag remains blocked", () => {
    process.env.NODE_ENV = "development";
    process.env.STUDIO_ENABLED = "true";
    delete process.env.STUDIO_MILITARY_EXPERT_ENABLED;
    assert.equal(isStudioMilitaryExpertLocalOverrideEnabled(), false);
    assert.equal(militaryExpertStudioVerdict(), "MILITARY_STUDIO_BLOCKED");
    assert.equal(isMilitaryExpertRecruitableInLocalStudio(), false);
  });

  it("4. development with flag but without launch ack remains blocked", () => {
    enableLocalMilitaryEnv();
    assert.equal(militaryExpertStudioVerdict(), "MILITARY_STUDIO_EXECUTABLE");
    assert.equal(
      isMilitaryExpertLaunchableInLocalStudio({
        privateUseAcknowledged: true,
        launchAcknowledged: false,
      }),
      false,
    );
  });

  it("5. authorized local override may recruit", () => {
    enableLocalMilitaryEnv();
    assert.equal(isMilitaryExpertRecruitableInLocalStudio(), true);
  });

  it("6. authorized local override may reach launch confirmation gate", () => {
    enableLocalMilitaryEnv();
    assert.equal(
      isMilitaryExpertLaunchableInLocalStudio({
        privateUseAcknowledged: true,
        launchAcknowledged: true,
      }),
      true,
    );
    assert.equal(validateMilitaryExpertLaunchAckToken(STUDIO_MILITARY_EXPERT_LAUNCH_ACK), true);
    assert.equal(validateMilitaryExpertLaunchAckToken(undefined), false);
  });

  it("7. launch ack token is required for execution path validation", () => {
    enableLocalMilitaryEnv();
    assert.equal(validateMilitaryExpertLaunchAckToken("wrong-token"), false);
  });

  it("8. Literary Agent launch policy unchanged", () => {
    enableLocalMilitaryEnv();
    assert.equal(
      isExpertLaunchableInStudio({
        expertKey: "literary_agent",
        privateUseAcknowledged: true,
      }),
      true,
    );
  });

  it("9. commercial catalog selectionEnabled unchanged for military", () => {
    enableLocalMilitaryEnv();
    assert.equal(getExpertCatalogEntry("military_expert")!.selectionEnabled, false);
  });

  it("10. absent flag values do not enable override", () => {
    process.env.NODE_ENV = "development";
    process.env.STUDIO_ENABLED = "true";
    process.env.STUDIO_MILITARY_EXPERT_ENABLED = "";
    assert.equal(isStudioMilitaryExpertLocalOverrideEnabled(), false);
    process.env.STUDIO_MILITARY_EXPERT_ENABLED = "yes";
    assert.equal(isStudioMilitaryExpertLocalOverrideEnabled(), false);
  });
});
