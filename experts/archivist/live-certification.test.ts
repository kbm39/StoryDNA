import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ARCHIVIST_LIVE_CERTIFICATION_REQUIRED_GATES,
  ARCHIVIST_LIVE_CERTIFICATION_THRESHOLDS,
  runArchivistLiveCertificationHarness,
} from "./live-certification.ts";
import { ARCHIVIST_LIVE_MODEL_CERTIFIED } from "./live-flags.ts";
import { ARCHIVIST_CERTIFICATION_STATUS } from "./contracts.ts";

describe("Archivist live-model certification harness (mocked, unpaid)", () => {
  it("declares the exact threshold required to set live_model_certified=true", () => {
    assert.deepEqual(
      [...ARCHIVIST_LIVE_CERTIFICATION_REQUIRED_GATES],
      [
        "continuity_detection",
        "false_positives",
        "both_side_evidence",
        "temporal_reasoning",
        "alias_ambiguity",
        "retcon_handling",
        "candidate_only_canon",
        "no_invented_facts",
        "structured_output_compliance",
      ],
    );
    assert.equal(
      ARCHIVIST_LIVE_CERTIFICATION_THRESHOLDS.continuity_detection
        .min_recall_on_expected_confirmed_safety_fixtures,
      1,
    );
    assert.equal(ARCHIVIST_LIVE_CERTIFICATION_THRESHOLDS.false_positives.max_false_positive_rate, 0);
    assert.equal(
      ARCHIVIST_LIVE_CERTIFICATION_THRESHOLDS.candidate_only_canon.accepted_canon_emissions_allowed,
      0,
    );
    assert.equal(
      ARCHIVIST_LIVE_CERTIFICATION_THRESHOLDS.candidate_only_canon
        .automatic_series_bible_acceptance_allowed,
      false,
    );
    assert.equal(ARCHIVIST_LIVE_CERTIFICATION_THRESHOLDS.structured_output_compliance.max_repair_calls, 1);
    assert.equal(ARCHIVIST_LIVE_CERTIFICATION_THRESHOLDS.set_live_model_certified, true);
    assert.equal(ARCHIVIST_LIVE_MODEL_CERTIFIED, true);
  });

  it("runs the mocked harness without paid calls and keeps execution gates closed", async () => {
    const report = await runArchivistLiveCertificationHarness();
    assert.equal(report.paid_certification_executed, false);
    assert.equal(report.live_model_certified, true);
    assert.equal(report.ready_to_set_live_model_certified, false);
    assert.equal(report.execution_wired, false);
    assert.equal(report.runtime_enabled, false);
    assert.equal(report.studio_selectable, false);
    assert.equal(report.certification_status, ARCHIVIST_CERTIFICATION_STATUS);
    assert.equal(report.mandatory_gates_passed, true, report.errors.join("\n") || report.gates.map((g) => `${g.gate}:${g.passed}:${g.detail}`).join("\n"));
    assert.deepEqual(
      report.gates.map((gate) => gate.gate),
      [...ARCHIVIST_LIVE_CERTIFICATION_REQUIRED_GATES],
    );
    assert.ok(report.gates.every((gate) => gate.passed));
  });
});
