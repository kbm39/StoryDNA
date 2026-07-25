import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MILITARY_EXPERT_APPROVED_PARITY_EXPORTS,
  runMilitaryExpertDeterministicParity,
} from "./military-expert-parity.ts";
import {
  EXPERT_MILITARY_GENERATION_CONTRACT_FLAG_NAME,
  readExpertMilitaryGenerationContractEnabled,
} from "./feature-flags.ts";
import { lookupAllowedPluginExport } from "./plugin-invocation-contracts.ts";

describe("Military Expert parity harness", () => {
  it("parity disabled when feature flag off", () => {
    const result = runMilitaryExpertDeterministicParity({
      featureFlagReader: () => false,
    });
    assert.equal(result.ok, false);
    assert.match(result.message ?? "", /EXPERT_MILITARY_GENERATION_CONTRACT_ENABLED/);
  });

  it("parity matches approved exports when bypassed", () => {
    const result = runMilitaryExpertDeterministicParity({ bypassFeatureFlag: true });
    assert.equal(result.ok, true);
    assert.equal(result.results.length, MILITARY_EXPERT_APPROVED_PARITY_EXPORTS.length + 3);
  });

  it("approved exports are on plugin allowlist", () => {
    assert.ok(
      lookupAllowedPluginExport(
        "@/experts/military-expert/prompts",
        "buildMilitaryExpertSystemPrompt",
      ),
    );
    assert.ok(
      lookupAllowedPluginExport(
        "@/experts/military-expert/parsing",
        "parseMilitaryExpertGenerationResponse",
      ),
    );
  });

  it("feature flag default off", () => {
    assert.equal(readExpertMilitaryGenerationContractEnabled({}), false);
    assert.equal(
      readExpertMilitaryGenerationContractEnabled({
        [EXPERT_MILITARY_GENERATION_CONTRACT_FLAG_NAME]: "true",
      }),
      true,
    );
  });
});
