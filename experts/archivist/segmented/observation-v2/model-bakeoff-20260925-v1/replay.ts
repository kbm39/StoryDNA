/**
 * $0 replay of the paid bake-off raw outputs through the current adapter.
 * Does not call a provider. Does not rewrite historical paid numbers.
 */

import { existsSync, readFileSync } from "node:fs";
import { adaptV2ProviderOutput } from "../adapter.ts";
import {
  V2_REAL_BREADTH_R8001_EXPECTED,
  V2_REAL_BREADTH_R8001_SEGMENT_ID,
  V2_REAL_BREADTH_R8016_EXPECTED,
  V2_REAL_BREADTH_R8016_SEGMENT_ID,
} from "../calibration-real-reckoning-breadth-v1/index.ts";
import {
  V2_REAL_CAL_R8011_EXPECTED,
  V2_REAL_CAL_R8011_SEGMENT_ID,
} from "../calibration-real-reckoning-v1/index.ts";
import type { V2ExpectedObservation } from "../calibration-v1/fixtures.ts";
import { scoreV2CalibrationSegment } from "../calibration-v1/score.ts";
import { V2_PHASE2_SYNTHETIC_STRESS_SEGMENT } from "../phase-2/index.ts";
import type { V2Observation } from "../types.ts";
import {
  r8001ClocksConfirmationGrade,
  r8011ColeKnownAndLearned,
  r8016SidesRetainedVerified,
  syntheticBothCompassStates,
  syntheticClockPresent,
  syntheticDetectionSufficient,
  syntheticFlareUsed,
  syntheticJossKnown,
  syntheticJossLearned,
  syntheticRadioUnavailable,
  V2_BAKEOFF_SYNTHETIC_EXPECTED,
} from "./fixtures.ts";
import {
  V2_MODEL_BAKEOFF_FROZEN_WINDOW_HASHES,
  V2_MODEL_BAKEOFF_ORDER,
  V2_MODEL_BAKEOFF_SESSION_ID,
  V2_MODEL_BAKEOFF_SYNTHETIC_SEGMENT_ID,
} from "./lock.ts";
import { V2_MODEL_BAKEOFF_HISTORICAL } from "./official.ts";

const ARTIFACT_PATH = `.calibration-results/${V2_MODEL_BAKEOFF_SESSION_ID}.json`;
const BREADTH_WINDOWS_PATH =
  ".calibration-results/archivist-v2-real-reckoning-breadth-20260925-v1.windows.json";
const REAL_WINDOWS_PATH =
  ".calibration-results/archivist-v2-real-reckoning-cal-20260925-v1.windows.json";

type Scenario = "synthetic" | "R8-001" | "R8-016" | "R8-011";
type Arm = "haiku" | "opus";

function parseEmitted(raw: string): number {
  try {
    const value = JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
    return Array.isArray(value?.observations) ? value.observations.length : 0;
  } catch {
    return 0;
  }
}

function detectionFor(scenario: Scenario, retained: readonly V2Observation[]) {
  if (scenario === "synthetic") {
    return {
      sufficient: syntheticDetectionSufficient(retained),
      details: {
        clock: syntheticClockPresent(retained),
        joss_known: syntheticJossKnown(retained),
        joss_learned: syntheticJossLearned(retained),
        radio_unavailable: syntheticRadioUnavailable(retained),
        flare_used: syntheticFlareUsed(retained),
        both_compass_states: syntheticBothCompassStates(retained),
      },
    };
  }
  if (scenario === "R8-001") {
    const sufficient = r8001ClocksConfirmationGrade(retained);
    return { sufficient, details: { both_clocks_verified: sufficient } };
  }
  if (scenario === "R8-016") {
    const sufficient = r8016SidesRetainedVerified(retained, V2_REAL_BREADTH_R8016_EXPECTED);
    return { sufficient, details: { both_statement_sides_verified: sufficient } };
  }
  return { sufficient: r8011ColeKnownAndLearned(retained), details: {} };
}

function expectedFor(scenario: Scenario): readonly V2ExpectedObservation[] {
  if (scenario === "synthetic") return V2_BAKEOFF_SYNTHETIC_EXPECTED;
  if (scenario === "R8-001") return V2_REAL_BREADTH_R8001_EXPECTED;
  if (scenario === "R8-016") return V2_REAL_BREADTH_R8016_EXPECTED;
  return V2_REAL_CAL_R8011_EXPECTED;
}

export function replaySavedModelBakeoff(): {
  artifact_available: boolean;
  provider_calls: 0;
  incremental_cost_usd: 0;
  historical: typeof V2_MODEL_BAKEOFF_HISTORICAL;
  cases: Array<{
    scenario: Scenario;
    arm: Arm;
    historical_required_correct: number;
    replay_required_correct: number;
    historical_detection: boolean;
    replay_detection: boolean;
    replay_retained: number;
    replay_fabricated: number;
    replay_stitched: number;
    replay_critical: number;
    replay_evidence_accuracy: number;
    missed: string[];
    matched: Array<{ expected_id: string; observation_id: string }>;
    details: Record<string, boolean | undefined>;
  }>;
  haiku: {
    detection_sufficient: number;
    required_correct: number;
    recall: number;
    evidence_accuracy: number;
    fabricated: number;
    critical_quarantines: number;
  };
  opus: {
    detection_sufficient: number;
    required_correct: number;
    recall: number;
    evidence_accuracy: number;
    fabricated: number;
    critical_quarantines: number;
  };
} {
  const historical = V2_MODEL_BAKEOFF_HISTORICAL;
  const emptyArm = {
    detection_sufficient: 0,
    required_correct: 0,
    recall: 0,
    evidence_accuracy: 0,
    fabricated: 0,
    critical_quarantines: 0,
  };
  if (!existsSync(ARTIFACT_PATH) || !existsSync(BREADTH_WINDOWS_PATH) || !existsSync(REAL_WINDOWS_PATH)) {
    return {
      artifact_available: false,
      provider_calls: 0,
      incremental_cost_usd: 0,
      historical,
      cases: [],
      haiku: emptyArm,
      opus: emptyArm,
    };
  }

  const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, "utf8")) as {
    raw: Record<string, string>;
    calls: Array<{ scenario: Scenario; arm: Arm; finish_reason: string | null }>;
  };
  const breadth = JSON.parse(readFileSync(BREADTH_WINDOWS_PATH, "utf8")) as {
    windows: Record<string, { prose: string; prose_sha256: string }>;
  };
  const real = JSON.parse(readFileSync(REAL_WINDOWS_PATH, "utf8")) as {
    windows: Record<string, { prose: string; prose_sha256: string }>;
  };

  const specs: Record<Scenario, { segmentId: string; prose: string }> = {
    synthetic: { segmentId: V2_MODEL_BAKEOFF_SYNTHETIC_SEGMENT_ID, prose: V2_PHASE2_SYNTHETIC_STRESS_SEGMENT },
    "R8-001": { segmentId: V2_REAL_BREADTH_R8001_SEGMENT_ID, prose: breadth.windows.r8001.prose },
    "R8-016": { segmentId: V2_REAL_BREADTH_R8016_SEGMENT_ID, prose: breadth.windows.r8016.prose },
    "R8-011": { segmentId: V2_REAL_CAL_R8011_SEGMENT_ID, prose: real.windows.r8011.prose },
  };

  if (breadth.windows.r8001.prose_sha256 !== V2_MODEL_BAKEOFF_FROZEN_WINDOW_HASHES["R8-001"]) {
    throw new Error("STOP: frozen R8-001 window hash drifted");
  }
  if (breadth.windows.r8016.prose_sha256 !== V2_MODEL_BAKEOFF_FROZEN_WINDOW_HASHES["R8-016"]) {
    throw new Error("STOP: frozen R8-016 window hash drifted");
  }
  if (real.windows.r8011.prose_sha256 !== V2_MODEL_BAKEOFF_FROZEN_WINDOW_HASHES["R8-011"]) {
    throw new Error("STOP: frozen R8-011 window hash drifted");
  }

  const historicalRequired: Record<`${Scenario}_${Arm}`, number> = {
    synthetic_haiku: historical.haiku.synthetic_required_correct,
    synthetic_opus: historical.opus.synthetic_required_correct,
    "R8-001_haiku": historical.haiku.r8001_required_correct,
    "R8-001_opus": historical.opus.r8001_required_correct,
    "R8-016_haiku": historical.haiku.r8016_required_correct,
    "R8-016_opus": historical.opus.r8016_required_correct,
    "R8-011_haiku": historical.haiku.r8011_required_correct,
    "R8-011_opus": historical.opus.r8011_required_correct,
  };
  const historicalDetection: Record<`${Scenario}_${Arm}`, boolean> = {
    synthetic_haiku: false,
    synthetic_opus: false,
    "R8-001_haiku": false,
    "R8-001_opus": false,
    "R8-016_haiku": false,
    "R8-016_opus": true,
    "R8-011_haiku": false,
    "R8-011_opus": false,
  };

  const cases = V2_MODEL_BAKEOFF_ORDER.map((step) => {
    const key = `${step.scenario}_${step.arm}` as const;
    const spec = specs[step.scenario];
    const raw = artifact.raw[key];
    const finish = artifact.calls.find((row) => row.scenario === step.scenario && row.arm === step.arm);
    const adapted = adaptV2ProviderOutput(raw, spec.segmentId, {
      segmentText: spec.prose,
      finishReason: finish?.finish_reason ?? null,
    });
    const expected = expectedFor(step.scenario);
    const score = scoreV2CalibrationSegment({
      segmentId: spec.segmentId,
      prose: spec.prose,
      expected: [...expected],
      emittedCount: parseEmitted(raw),
      retained: adapted.retained,
      quarantined: adapted.quarantined.filter((item) => item.reason !== "duplicate").length,
      duplicatesSuppressed: adapted.suppressed_duplicates,
    });
    const detection = detectionFor(step.scenario, adapted.retained);
    const critical = adapted.quarantined.filter((item) =>
      item.reason === "non_contiguous_evidence" ||
      item.reason === "insufficient_evidence" ||
      item.reason === "invalid_payload" ||
      item.reason === "editorial_output" ||
      item.reason === "laterality_evidence_conflict"
    );
    return {
      scenario: step.scenario,
      arm: step.arm,
      historical_required_correct: historicalRequired[key],
      replay_required_correct: score.true_positives,
      historical_detection: historicalDetection[key],
      replay_detection: detection.sufficient,
      replay_retained: adapted.retained.length,
      replay_fabricated: score.fabricated_evidence,
      replay_stitched: adapted.quarantined.filter((item) => item.reason === "non_contiguous_evidence").length,
      replay_critical: critical.length,
      replay_evidence_accuracy: score.evidence_accuracy,
      missed: score.missed,
      matched: score.matched,
      details: detection.details,
    };
  });

  function armMetrics(arm: Arm) {
    const rows = cases.filter((row) => row.arm === arm);
    const requiredCorrect = rows.reduce((sum, row) => sum + row.replay_required_correct, 0);
    const evidenceValidWeighted = rows.reduce((sum, row) => sum + row.replay_evidence_accuracy * row.replay_retained, 0);
    const retained = rows.reduce((sum, row) => sum + row.replay_retained, 0);
    return {
      detection_sufficient: rows.filter((row) => row.replay_detection).length,
      required_correct: requiredCorrect,
      recall: Number((requiredCorrect / 16).toFixed(3)),
      evidence_accuracy: retained === 0 ? 0 : Number((evidenceValidWeighted / retained).toFixed(3)),
      fabricated: rows.reduce((sum, row) => sum + row.replay_fabricated, 0),
      critical_quarantines: rows.reduce((sum, row) => sum + row.replay_critical, 0),
    };
  }

  return {
    artifact_available: true,
    provider_calls: 0,
    incremental_cost_usd: 0,
    historical,
    cases,
    haiku: armMetrics("haiku"),
    opus: armMetrics("opus"),
  };
}
