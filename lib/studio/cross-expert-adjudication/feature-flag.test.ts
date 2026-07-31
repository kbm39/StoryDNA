import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCrossExpertAdjudicationAuditEnabled } from "./feature-flag.ts";

describe("cross-expert adjudication feature flag", () => {
  it("is enabled in local Kevin Studio by default", () => {
    const prevStudio = process.env.STUDIO_ENABLED;
    const prevFlag = process.env.CROSS_EXPERT_ADJUDICATION_AUDIT;
    process.env.STUDIO_ENABLED = "true";
    delete process.env.CROSS_EXPERT_ADJUDICATION_AUDIT;
    assert.equal(isCrossExpertAdjudicationAuditEnabled(), true);
    process.env.STUDIO_ENABLED = prevStudio;
    if (prevFlag === undefined) delete process.env.CROSS_EXPERT_ADJUDICATION_AUDIT;
    else process.env.CROSS_EXPERT_ADJUDICATION_AUDIT = prevFlag;
  });
});
