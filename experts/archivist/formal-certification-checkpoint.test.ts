import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ARCHIVIST_CERTIFICATION_STATUS, ARCHIVIST_VERSION } from "./contracts.ts";
import { ARCHIVIST_CONSTITUTION } from "./constitution.ts";
import { archivistRuntimeDefinition } from "./runtime-definition.ts";
import { archivistRegistryDefinitionV1 } from "./registry-definition.ts";
import {
  ARCHIVIST_LIVE_MODEL_CERTIFIED,
  ARCHIVIST_LIVE_MODEL_CERTIFIED_SEMANTICS,
  archivistLiveGateSnapshot,
  isArchivistLiveExecutionAllowed,
} from "./live-flags.ts";
import { ARCHIVIST_SMOKE_20260922_V1_EVIDENCE } from "./session-archivist-smoke-20260922-v1.ts";
import { ARCHIVIST_SMOKE_20260922_V2_EVIDENCE } from "./session-archivist-smoke-20260922-v2.ts";
import { ARCHIVIST_SMOKE_20260922_V3_EVIDENCE } from "./session-archivist-smoke-20260922-v3.ts";
import { ARCHIVIST_CERT_20260924_V1_EVIDENCE } from "./session-archivist-cert-20260924-v1.ts";
import { ARCHIVIST_CERT_20260924_V2_EVIDENCE } from "./session-archivist-cert-20260924-v2.ts";
import { ARCHIVIST_CERT_20260924_V3_EVIDENCE } from "./session-archivist-cert-20260924-v3.ts";
import { ARCHIVIST_CERT_20260924_V4_EVIDENCE } from "./session-archivist-cert-20260924-v4.ts";
import {
  ARCHIVIST_CERTIFICATION_HISTORY,
  ARCHIVIST_CERTIFICATION_OBJECT,
  ARCHIVIST_CERTIFICATION_SAFETY_GATES,
  ARCHIVIST_CERTIFIED_CODE_SHA,
  ARCHIVIST_FORMAL_CERTIFICATION_RECORD,
  ARCHIVIST_RAW_MODEL_CERTIFIED,
} from "./formal-certification-checkpoint.ts";
import {
  HOLD_FAST_BOOK_2_GATE,
  HOLD_FAST_PILOT_PLAN,
  RECKONING_STAGING_PILOT,
} from "./hold-fast-pilot.ts";

describe("Archivist formal certification checkpoint", () => {
  it("preserves historical official results without rewriting them", () => {
    assert.equal(ARCHIVIST_SMOKE_20260922_V1_EVIDENCE.session_id, "archivist-smoke-20260922-v1");
    assert.equal(ARCHIVIST_SMOKE_20260922_V2_EVIDENCE.official_result, "0/3 failed certification");
    assert.equal(ARCHIVIST_SMOKE_20260922_V2_EVIDENCE.not_a_pass, true);
    assert.equal(ARCHIVIST_SMOKE_20260922_V3_EVIDENCE.official_result, "3/3 PASS");
    assert.equal(ARCHIVIST_CERT_20260924_V1_EVIDENCE.official_result, "12/15 FAIL");
    assert.equal(ARCHIVIST_CERT_20260924_V2_EVIDENCE.official_result, "12/15 FAIL");
    assert.equal(ARCHIVIST_CERT_20260924_V3_EVIDENCE.official_result, "13/15 FAIL");
    assert.equal(ARCHIVIST_CERT_20260924_V3_EVIDENCE.not_a_pass, true);
    assert.equal(ARCHIVIST_CERT_20260924_V4_EVIDENCE.official_result, "15/15 PASS");
    assert.deepEqual(ARCHIVIST_CERTIFICATION_HISTORY, {
      "archivist-smoke-20260922-v1": "structured-output failure",
      "archivist-smoke-20260922-v2": "entity/temporal contract failure",
      "archivist-smoke-20260922-v3": "3/3 PASS",
      "archivist-cert-20260924-v1": "12/15 FAIL",
      "archivist-cert-20260924-v2": "12/15 FAIL",
      "archivist-cert-20260924-v3": "13/15 FAIL",
      "archivist-cert-20260924-v4": "15/15 PASS",
    });
  });

  it("certifies the full pipeline, not raw Haiku accuracy", () => {
    assert.equal(
      ARCHIVIST_LIVE_MODEL_CERTIFIED_SEMANTICS,
      "complete_configured_live_expert_pipeline_using_certified_model",
    );
    assert.equal(ARCHIVIST_CERTIFICATION_OBJECT, "full_archivist_pipeline");
    assert.equal(ARCHIVIST_RAW_MODEL_CERTIFIED, false);
    assert.equal(ARCHIVIST_CERT_20260924_V4_EVIDENCE.raw_model_detection, "5/7");
    assert.equal(ARCHIVIST_CERT_20260924_V4_EVIDENCE.final_storydna_detection, "7/7");
    assert.equal(ARCHIVIST_FORMAL_CERTIFICATION_RECORD.raw_model_certified, false);
    assert.equal(ARCHIVIST_FORMAL_CERTIFICATION_RECORD.certified_object, "full_archivist_pipeline");
    assert.equal(ARCHIVIST_FORMAL_CERTIFICATION_RECORD.model_detection, "5/7");
    assert.equal(ARCHIVIST_FORMAL_CERTIFICATION_RECORD.final_storydna_detection, "7/7");
  });

  it("sets live_model_certified and keeps execution, runtime, and Studio closed", () => {
    const gates = archivistLiveGateSnapshot();
    assert.equal(ARCHIVIST_LIVE_MODEL_CERTIFIED, true);
    assert.equal(gates.live_model_certified, true);
    assert.equal(gates.execution_wired, false);
    assert.equal(gates.runtime_enabled, false);
    assert.equal(gates.studio_selectable, false);
    assert.equal(gates.registry_execution_wired, false);
    assert.equal(isArchivistLiveExecutionAllowed(), false);
    assert.equal(ARCHIVIST_CONSTITUTION.execution_wired, false);
    assert.equal(ARCHIVIST_CONSTITUTION.studio_selectable, false);
    assert.equal(archivistRuntimeDefinition().enabled, false);
    assert.equal(archivistRegistryDefinitionV1().registry_metadata?.execution_wired, false);
    assert.equal(ARCHIVIST_CERTIFICATION_STATUS, "draft_not_certified");
    assert.equal(ARCHIVIST_FORMAL_CERTIFICATION_RECORD.execution_wired, false);
    assert.equal(ARCHIVIST_FORMAL_CERTIFICATION_RECORD.runtime_enabled, false);
    assert.equal(ARCHIVIST_FORMAL_CERTIFICATION_RECORD.studio_selectable, false);
    assert.equal(ARCHIVIST_FORMAL_CERTIFICATION_RECORD.production_authorized, false);
    assert.equal(ARCHIVIST_FORMAL_CERTIFICATION_RECORD.real_manuscript_authorized, false);
    assert.equal(ARCHIVIST_FORMAL_CERTIFICATION_RECORD.hold_fast_authorized, false);
  });

  it("freezes the v4 evidence record required for the checkpoint", () => {
    assert.equal(ARCHIVIST_FORMAL_CERTIFICATION_RECORD.expert, "archivist");
    assert.equal(ARCHIVIST_FORMAL_CERTIFICATION_RECORD.expert_version, ARCHIVIST_VERSION);
    assert.equal(ARCHIVIST_FORMAL_CERTIFICATION_RECORD.provider, "Anthropic");
    assert.equal(ARCHIVIST_FORMAL_CERTIFICATION_RECORD.model, "claude-haiku-4-5-20251001");
    assert.equal(ARCHIVIST_FORMAL_CERTIFICATION_RECORD.code_sha, ARCHIVIST_CERTIFIED_CODE_SHA);
    assert.equal(ARCHIVIST_CERTIFIED_CODE_SHA, "7a90ea6a7815948ce2d5e0f3351f66f3826b3a94");
    assert.equal(ARCHIVIST_FORMAL_CERTIFICATION_RECORD.suite, "archivist-cert-20260924-v4");
    assert.equal(ARCHIVIST_FORMAL_CERTIFICATION_RECORD.official, "15/15 PASS");
    assert.equal(ARCHIVIST_FORMAL_CERTIFICATION_RECORD.false_promotions, 0);
    assert.equal(ARCHIVIST_FORMAL_CERTIFICATION_RECORD.false_downgrades, 0);
    assert.equal(ARCHIVIST_FORMAL_CERTIFICATION_RECORD.structured_output, "15/15");
    assert.equal(ARCHIVIST_FORMAL_CERTIFICATION_RECORD.repair_calls, 0);
    assert.equal(ARCHIVIST_FORMAL_CERTIFICATION_RECORD.confirmed_evidence_compliance, "100%");
    assert.equal(ARCHIVIST_FORMAL_CERTIFICATION_RECORD.canon_safety, "PASS");
    assert.equal(ARCHIVIST_FORMAL_CERTIFICATION_RECORD.ambiguity_safety, "PASS");
    assert.equal(ARCHIVIST_FORMAL_CERTIFICATION_RECORD.retcon_handling, "PASS");
    assert.equal(ARCHIVIST_FORMAL_CERTIFICATION_RECORD.temporal_controls, "PASS");
    assert.equal(ARCHIVIST_FORMAL_CERTIFICATION_RECORD.canon_writes, 0);
    assert.equal(ARCHIVIST_FORMAL_CERTIFICATION_RECORD.cost_usd, 0.110109);
    assert.ok(Object.values(ARCHIVIST_CERTIFICATION_SAFETY_GATES).every((gate) => gate === true));
  });

  it("prepares The Reckoning staging pilot without authorizing a run", () => {
    assert.equal(RECKONING_STAGING_PILOT.series, "Hold Fast");
    assert.equal(RECKONING_STAGING_PILOT.book, "The Reckoning");
    assert.equal(RECKONING_STAGING_PILOT.authorized_to_run, false);
    assert.equal(RECKONING_STAGING_PILOT.run_now, false);
    assert.equal(RECKONING_STAGING_PILOT.automatic_canon_changes, false);
    assert.equal(RECKONING_STAGING_PILOT.author_acceptance, "after_review");
    assert.deepEqual(RECKONING_STAGING_PILOT.must_produce, [
      "findings",
      "both_side_evidence",
      "candidate_canon",
      "entity_ambiguities",
      "model_vs_final_classification_diagnostics",
      "full_cost_ledger",
    ]);
    assert.equal(HOLD_FAST_BOOK_2_GATE.book, "No Mercy");
    assert.equal(HOLD_FAST_BOOK_2_GATE.authorized, false);
    assert.equal(HOLD_FAST_PILOT_PLAN.run_now, false);
  });
});
