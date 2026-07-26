import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  auditMilitaryExpertSummaryBalance,
  MILITARY_EXPERT_SUMMARY_BALANCE_VERSION,
  validateMilitaryExpertSummaryBalance,
} from "./output-schema.ts";

describe("military expert summary balance v2", () => {
  it("accepts valid strengths array for cross-field balance", () => {
    const audit = auditMilitaryExpertSummaryBalance(
      "The corporal-led platoon assignment is a confirmed chain-of-command concern.",
      [{ realism_status: "confirmed_error" }],
      {
        strengths: ["Clear operational intent and readable command pressure"],
        conclusion:
          "Command intent is clear, but the corporal-led platoon assignment is a confirmed realism error requiring correction.",
      },
    );
    assert.equal(audit.version, MILITARY_EXPERT_SUMMARY_BALANCE_VERSION);
    assert.equal(audit.cross_field_balanced, true);
    assert.ok(audit.satisfied_fields.includes("strengths"));
  });

  it("fails one-sided hostile review", () => {
    const errors: string[] = [];
    validateMilitaryExpertSummaryBalance(
      "This scene is entirely wrong and should be rewritten from scratch.",
      [{ realism_status: "confirmed_error" }],
      errors,
      { strengths: ["good"], conclusion: "Nothing in this scene works." },
    );
    assert.ok(errors.some((entry) => entry.includes("material strengths")));
  });

  it("fails generic praise without meaningful strengths", () => {
    const errors: string[] = [];
    validateMilitaryExpertSummaryBalance("Nice writing overall.", [], errors, {
      strengths: ["good"],
      conclusion: "Looks fine.",
    });
    assert.ok(errors.some((entry) => entry.includes("material strengths")));
  });

  it("does not require invented concerns for true-negative output", () => {
    const errors: string[] = [];
    validateMilitaryExpertSummaryBalance(
      "No material inaccuracies were found in the supplied command interaction.",
      [],
      errors,
      {
        strengths: ["Plausible executive-officer coordination before the fragmentary order"],
        conclusion: "Company command interaction is credible; no material inaccuracies were found.",
      },
    );
    assert.equal(errors.length, 0);
  });

  it("does not pass on embedded unrelated words", () => {
    const audit = auditMilitaryExpertSummaryBalance("The inaccurate framing is the main issue.", [], {
      strengths: ["unaccurate"],
      conclusion: "inaccurate overall",
    });
    assert.equal(audit.cross_field_balanced, false);
  });
});
