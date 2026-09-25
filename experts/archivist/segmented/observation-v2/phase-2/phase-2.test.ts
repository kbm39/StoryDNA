import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { RULE8_VERIFIED_CASES } from "@/experts/archivist/benchmarks/reckoning-rule8/fixture.ts";
import { scoreVerifiedCases } from "@/experts/archivist/benchmarks/reckoning-rule8/score.ts";
import { ARCHIVIST_CONSTITUTION } from "../../../constitution.ts";
import { isArchivistLiveExecutionAllowed } from "../../../live-flags.ts";
import { archivistRuntimeDefinition } from "../../../runtime-definition.ts";
import { V2_REAL_BREADTH_REMAINING_UNSEEN } from "../calibration-real-reckoning-breadth-v1/selection.ts";
import { REAL_BREADTH_OFFICIAL_METRICS } from "../calibration-real-reckoning-breadth-v1/official.ts";
import { REAL_RECKONING_OFFICIAL_METRICS } from "../calibration-real-reckoning-v1/replay.ts";
import { RULE8_V1_FROZEN_BASELINE } from "../constants.ts";
import { V2_EVIDENCE_GATE_VERSION } from "../evidence-contiguity.ts";
import { V2_PROPOSITION_RECOVERY_VERSION } from "../proposition-recovery.ts";
import { V2_TRUNCATED_PREFIX_RECOVERY_VERSION } from "../truncated-prefix-recovery.ts";
import { V2_UNICODE_PUNCTUATION_EQUIVALENCE_VERSION } from "../unicode-punctuation-equivalence.ts";
import {
  V2_EXTRACTION_PROMPT_V1_VERSION,
  V2_EXTRACTION_PROMPT_VERSION,
  V2_PROMPT_MAX_TOKENS,
  V2_PROMPT_WIRED_TO_PAID_PATH,
  assertHistoricalV1PromptPreserved,
  assertV2PromptCoversObservationKinds,
  buildV2ObservationSystemPrompt,
  buildV2ObservationSystemPromptV1,
  buildV2ObservationUserPrompt,
  v2PromptForbidsEditorialOutput,
} from "../prompt.ts";
import { PHASE1_OFFICIAL_COMBINED_DIAGNOSTIC } from "../remediation-phase-1/official-locks.ts";
import { replayNineConsumedRealProseCases } from "../remediation-phase-1/replay.ts";
import {
  V2_PHASE2_FUTURE_CAL_AUTHORIZED_TO_RUN,
  V2_PHASE2_FUTURE_CAL_CALLS,
  V2_PHASE2_FUTURE_CAL_CEILING_USD,
  V2_PHASE2_FUTURE_CAL_MAX_PRIMARY_CALLS,
  V2_PHASE2_FUTURE_CAL_MAX_REPAIR_CALLS,
  V2_PHASE2_FUTURE_CAL_REGRESSION_ALTERNATE,
  V2_PHASE2_HELD_OUT_IDS,
  V2_PHASE2_PROMPT_MAX_TOKENS,
  V2_PHASE2_PROMPT_VERSION,
  V2_PHASE2_PROVIDER_CALLS,
  V2_PHASE2_SCHEMA,
  V2_PHASE2_SUCCESS_BAR,
  V2_PHASE2_SYNTHETIC_STRESS_SEGMENT,
  V2_PHASE2_WIRED_TO_PAID_PATH,
} from "./index.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)));

const HELD_OUT_FORBIDDEN_IN_PROMPT = [
  ...V2_PHASE2_HELD_OUT_IDS,
  "Cole",
  "Ari",
  "Hank",
  "Preacher",
  "numi numi",
  "REVISED-13",
] as const;

describe("archivist v2 phase 2 prompt", () => {
  it("preserves historical prompt v1 and publishes prompt v2", () => {
    assert.equal(V2_EXTRACTION_PROMPT_V1_VERSION, "archivist_v2_extraction_prompt@v1");
    assert.equal(V2_EXTRACTION_PROMPT_VERSION, "archivist_v2_extraction_prompt@v2");
    assert.equal(V2_PHASE2_PROMPT_VERSION, "archivist_v2_extraction_prompt@v2");
    assert.equal(V2_PHASE2_SCHEMA, "archivist_segment_observation@v2");
    assert.equal(assertHistoricalV1PromptPreserved(), true);
    assert.match(buildV2ObservationSystemPromptV1(), /Cole uses\/recognizes/);
    assert.equal(V2_PROMPT_WIRED_TO_PAID_PATH, false);
    assert.equal(V2_PHASE2_WIRED_TO_PAID_PATH, false);
    assert.equal(V2_PHASE2_PROVIDER_CALLS, 0);
  });

  it("contains the approved Phase 2 extraction rules", () => {
    const prompt = buildV2ObservationSystemPrompt();
    const user = buildV2ObservationUserPrompt({
      segmentId: "seg-phase2",
      segmentText: V2_PHASE2_SYNTHETIC_STRESS_SEGMENT,
    });
    assert.deepEqual(assertV2PromptCoversObservationKinds(), []);
    assert.equal(v2PromptForbidsEditorialOutput(), true);
    assert.match(prompt, /archivist_v2_extraction_prompt@v2|THE MODEL OBSERVES THE MANUSCRIPT/);
    assert.match(prompt, /TIER 1 — emit first/);
    assert.match(prompt, /TIER 2 — after Tier 1/);
    assert.match(prompt, /TIER 3 — omit first under output pressure/);
    assert.match(prompt, /Emit Tier 1 before Tier 2/);
    assert.match(prompt, /Close observations\[\] and the root JSON before truncation/);
    assert.match(prompt, /Do not begin an observation you cannot finish/);
    assert.match(prompt, /prefer approximately 8–14 continuity-grade observations/);
    assert.match(prompt, /Never drop a Tier 1 observation merely to satisfy 14/);
    assert.match(prompt, /Quote the SHORTEST exact contiguous manuscript span/);
    assert.match(prompt, /One observation normally cites one contiguous supporting span/);
    assert.match(prompt, /known: character explicitly uses/);
    assert.match(prompt, /learned: character receives an explanation/);
    assert.match(prompt, /Explainer vs learner/);
    assert.match(prompt, /Use before acquisition/);
    assert.match(prompt, /One passage may yield more than one observation ONLY when/);
    assert.match(prompt, /Redundancy rule/);
    assert.match(prompt, /JSON only/);
    assert.match(prompt, /If the typed payload is complete, omit nested proposition/);
    assert.match(prompt, /At 07:12 the ferry left/);
    assert.match(prompt, /blue cache token/);
    assert.match(prompt, /rover fired its only flare/);
    assert.match(prompt, /brass compass/);
    assert.match(prompt, /Do not find contradictions/);
    assert.match(prompt, /Do not find continuity errors/);
    assert.equal(V2_PROMPT_MAX_TOKENS, 4000);
    assert.equal(V2_PHASE2_PROMPT_MAX_TOKENS, 4000);
    assert.match(user, /shortest exact contiguous excerpt/);
    assert.match(user, /Close JSON before truncation/);
  });

  it("excludes overfitting and held-out material from model-facing prompt v2", () => {
    const prompt = buildV2ObservationSystemPrompt();
    const user = buildV2ObservationUserPrompt({
      segmentId: "seg-phase2",
      segmentText: "placeholder",
    });
    for (const needle of HELD_OUT_FORBIDDEN_IN_PROMPT) {
      assert.equal(prompt.includes(needle), false, `prompt v2 leaked ${needle}`);
      assert.equal(user.includes(needle), false, `user prompt leaked ${needle}`);
    }
    assert.doesNotMatch(prompt, /R8-\d{3}/);
    assert.match(prompt, /Do not find contradictions/);
    assert.doesNotMatch(V2_PHASE2_SYNTHETIC_STRESS_SEGMENT, /Cole|Ari|Hank|Preacher|numi numi|REVISED-13|R8-/);
  });

  it("keeps the exact 15 held-out IDs out of Phase 2 prompt and synthetic fixtures", () => {
    assert.deepEqual([...V2_PHASE2_HELD_OUT_IDS], [...V2_REAL_BREADTH_REMAINING_UNSEEN]);
    assert.equal(V2_PHASE2_HELD_OUT_IDS.length, 15);
    const prompt = buildV2ObservationSystemPrompt();
    const fixture = readFileSync(join(ROOT, "fixtures.ts"), "utf8");
    for (const id of V2_PHASE2_HELD_OUT_IDS) {
      assert.equal(prompt.includes(id), false, `prompt selected ${id}`);
      assert.equal(fixture.includes(id), false, `phase 2 fixture selected ${id}`);
    }
    for (const file of ["fixtures.ts", "index.ts"]) {
      const source = readFileSync(join(ROOT, file), "utf8");
      assert.doesNotMatch(source, /createPaidPilotAnthropicProvider|@anthropic-ai\/sdk|from "openai"/);
    }
  });

  it("freezes the future 3-call development calibration without authorizing it", () => {
    assert.equal(V2_PHASE2_FUTURE_CAL_AUTHORIZED_TO_RUN, false);
    assert.equal(V2_PHASE2_FUTURE_CAL_MAX_PRIMARY_CALLS, 3);
    assert.equal(V2_PHASE2_FUTURE_CAL_MAX_REPAIR_CALLS, 0);
    assert.deepEqual([...V2_PHASE2_FUTURE_CAL_CALLS], ["synthetic_phase2_stress", "R8-001", "R8-016"]);
    assert.equal(V2_PHASE2_FUTURE_CAL_REGRESSION_ALTERNATE, "R8-029");
    assert.equal(V2_PHASE2_FUTURE_CAL_CEILING_USD, 0.1);
    assert.equal(V2_PHASE2_SUCCESS_BAR.r8010_pass_is_not_a_criterion, true);
    assert.equal(V2_PHASE2_SUCCESS_BAR.r8011_pass_is_not_a_criterion, true);
    assert.equal(V2_PHASE2_SUCCESS_BAR.fabricated_evidence, 0);
    assert.equal(V2_PHASE2_SUCCESS_BAR.evidence_accuracy, 1);
    for (const id of V2_PHASE2_HELD_OUT_IDS) {
      assert.equal((V2_PHASE2_FUTURE_CAL_CALLS as readonly string[]).includes(id), false);
    }
  });

  it("does not rewrite historical official scores or Phase 1 replay diagnostic", () => {
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.detection_sufficient_cases, 4);
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.verdict, "MIXED GENERALIZATION");
    assert.equal(REAL_RECKONING_OFFICIAL_METRICS.verdict, "REAL-PROSE V2 NEEDS REMEDIATION");
    assert.equal(PHASE1_OFFICIAL_COMBINED_DIAGNOSTIC.sufficient, 5);
    const metrics = scoreVerifiedCases(RULE8_VERIFIED_CASES);
    assert.equal(metrics.detected, RULE8_V1_FROZEN_BASELINE.detected);
    assert.equal(RULE8_V1_FROZEN_BASELINE.detected, 0);
    const replay = replayNineConsumedRealProseCases();
    const available = replay.cases.filter((item) => item.artifact_available);
    if (available.length > 0) {
      assert.equal(available.filter((item) => item.replay_detection === "SUFFICIENT").length, 7);
    }
    assert.equal(V2_EVIDENCE_GATE_VERSION, "archivist_v2_contiguous_evidence@v1");
    assert.equal(V2_PROPOSITION_RECOVERY_VERSION, "archivist_v2_proposition_recovery@v1");
    assert.equal(V2_TRUNCATED_PREFIX_RECOVERY_VERSION, "archivist_v2_truncated_prefix_recovery@v1");
    assert.equal(V2_UNICODE_PUNCTUATION_EQUIVALENCE_VERSION, "archivist_v2_unicode_punctuation_equivalent@v1");
    assert.equal(isArchivistLiveExecutionAllowed(), false);
    assert.equal(ARCHIVIST_CONSTITUTION.execution_wired, false);
    assert.equal(ARCHIVIST_CONSTITUTION.studio_selectable, false);
    assert.equal(archivistRuntimeDefinition().enabled, false);
  });
});
