/**
 * $0 replay of the official real-Reckoning V2 calibration through compact
 * proposition recovery. Does not call a provider. Does not rewrite the official artifact.
 */

import { readFileSync } from "node:fs";
import { adaptV2ProviderOutput } from "../adapter.ts";
import {
  combineSegmentScores,
  scoreV2CalibrationByKind,
  scoreV2CalibrationSegment,
} from "../calibration-v1/score.ts";
import type { V2Observation, V2ObservationKind } from "../types.ts";
import {
  V2_REAL_CAL_R8010_SEGMENT_ID,
  V2_REAL_CAL_R8011_SEGMENT_ID,
  V2_REAL_CAL_R8029_SEGMENT_ID,
  V2_REAL_RECKONING_CAL_V1_SESSION_ID,
  r8010DetectionSufficient,
  r8011DetectionSufficient,
  r8029DetectionSufficient,
  realCalExpectedFor,
} from "./index.ts";

export const REAL_RECKONING_REPLAY_MODE = "zero_dollar_saved_output_replay" as const;

export const REAL_RECKONING_OFFICIAL_METRICS = {
  expected: 8,
  retained: 17,
  true_positives: 3,
  recall: 0.375,
  precision: 0.176,
  evidence_accuracy: 1,
  fabricated_evidence: 0,
  provider_calls: 3,
  cost_usd: 0.048356,
  repairs: 0,
  verdict: "REAL-PROSE V2 NEEDS REMEDIATION",
  cases: {
    r8010: "FAIL",
    r8011: "PARTIAL",
    r8029: "PASS",
  },
} as const;

function parseEmitted(raw: string): { count: number; kinds: V2ObservationKind[] } {
  try {
    const value = JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
    const rows = Array.isArray(value?.observations) ? value.observations : [];
    return {
      count: rows.length,
      kinds: rows.map((row: { kind?: string }) => row.kind).filter(Boolean) as V2ObservationKind[],
    };
  } catch {
    return { count: 0, kinds: [] };
  }
}

function loadAuthorizedProse(): { r8010: string; r8011: string; r8029: string } {
  const windows = JSON.parse(
    readFileSync(
      `.calibration-results/${V2_REAL_RECKONING_CAL_V1_SESSION_ID}.windows.json`,
      "utf8",
    ),
  ) as { windows: { r8010: { prose: string }; r8011: { prose: string }; r8029: { prose: string } } };
  return {
    r8010: windows.windows.r8010.prose,
    r8011: windows.windows.r8011.prose,
    r8029: windows.windows.r8029.prose,
  };
}

function replayCase(args: { raw: string; segmentId: string; prose: string }) {
  const emitted = parseEmitted(args.raw);
  const adapted = adaptV2ProviderOutput(args.raw, args.segmentId, { segmentText: args.prose });
  const score = scoreV2CalibrationSegment({
    segmentId: args.segmentId,
    prose: args.prose,
    expected: realCalExpectedFor(args.segmentId),
    emittedCount: emitted.count,
    retained: adapted.retained,
    quarantined: adapted.quarantined.filter((item) => item.reason !== "duplicate").length,
    duplicatesSuppressed: adapted.suppressed_duplicates,
  });
  return { emitted, adapted, score };
}

function capabilityBrief(retained: readonly V2Observation[]) {
  return retained
    .filter((item) => item.kind === "operational_capability")
    .map((item) => ({
      id: item.id,
      entity: (item.payload as { entity?: string }).entity ?? null,
      capability_type: (item.payload as { capability_type?: string }).capability_type ?? null,
      state: (item.payload as { state?: string }).state ?? null,
      laterality: null,
      excerpt: item.evidence.excerpt,
      evidence_status: item.evidence.evidence_status ?? null,
      proposition: item.proposition,
    }));
}

export function replaySavedRealReckoningCalibration(raw: {
  r8010: string;
  r8011: string;
  r8029: string;
}) {
  const prose = loadAuthorizedProse();
  const r8010 = replayCase({ raw: raw.r8010, segmentId: V2_REAL_CAL_R8010_SEGMENT_ID, prose: prose.r8010 });
  const r8011 = replayCase({ raw: raw.r8011, segmentId: V2_REAL_CAL_R8011_SEGMENT_ID, prose: prose.r8011 });
  const r8029 = replayCase({ raw: raw.r8029, segmentId: V2_REAL_CAL_R8029_SEGMENT_ID, prose: prose.r8029 });
  const allRetained = [...r8010.adapted.retained, ...r8011.adapted.retained, ...r8029.adapted.retained];
  const overall = combineSegmentScores([r8010.score, r8011.score, r8029.score]);
  const detection = {
    r8010: r8010DetectionSufficient(r8010.adapted.retained),
    r8011: r8011DetectionSufficient(r8011.adapted.retained),
    r8029: r8029DetectionSufficient(r8029.adapted.retained),
  };
  return {
    replay_mode: REAL_RECKONING_REPLAY_MODE,
    session_id: V2_REAL_RECKONING_CAL_V1_SESSION_ID,
    official_verdict_unrewritten: REAL_RECKONING_OFFICIAL_METRICS.verdict,
    provider_calls: 0,
    incremental_cost_usd: 0,
    official: REAL_RECKONING_OFFICIAL_METRICS,
    r8010: {
      hard_failure: r8010.adapted.hard_failure,
      retained_ids: r8010.adapted.retained.map((item) => item.id),
      quarantined: r8010.adapted.quarantined.map((item) => ({
        id: item.observation_id,
        reason: item.reason,
      })),
      normalizations: r8010.adapted.normalizations,
      score: r8010.score,
      capabilities: capabilityBrief(r8010.adapted.retained),
      ari_statement_retained: r8010.adapted.retained.some(
        (item) => item.kind === "statement" && /ari/i.test(item.proposition.subject + item.evidence.excerpt),
      ),
      missile_event_retained: r8010.adapted.retained.some((item) => item.kind === "event" && /missile/i.test(JSON.stringify(item))),
      detection_sufficient: detection.r8010,
    },
    r8011: {
      hard_failure: r8011.adapted.hard_failure,
      retained_ids: r8011.adapted.retained.map((item) => item.id),
      quarantined: r8011.adapted.quarantined.map((item) => ({
        id: item.observation_id,
        reason: item.reason,
      })),
      normalizations: r8011.adapted.normalizations,
      score: r8011.score,
      detection_sufficient: detection.r8011,
    },
    r8029: {
      hard_failure: r8029.adapted.hard_failure,
      retained_ids: r8029.adapted.retained.map((item) => item.id),
      quarantined: r8029.adapted.quarantined.map((item) => ({
        id: item.observation_id,
        reason: item.reason,
      })),
      normalizations: r8029.adapted.normalizations,
      score: r8029.score,
      injuries: r8029.adapted.retained
        .filter((item) => item.kind === "injury")
        .map((item) => ({
          id: item.id,
          laterality: (item.payload as { laterality?: string }).laterality ?? null,
          body_region: (item.payload as { body_region?: string }).body_region ?? null,
          excerpt: item.evidence.excerpt,
          evidence_status: item.evidence.evidence_status ?? null,
        })),
      detection_sufficient: detection.r8029,
    },
    overall,
    by_kind: scoreV2CalibrationByKind({
      expected: [
        ...realCalExpectedFor(V2_REAL_CAL_R8010_SEGMENT_ID),
        ...realCalExpectedFor(V2_REAL_CAL_R8011_SEGMENT_ID),
        ...realCalExpectedFor(V2_REAL_CAL_R8029_SEGMENT_ID),
      ],
      retained: allRetained,
      emittedKinds: [...r8010.emitted.kinds, ...r8011.emitted.kinds, ...r8029.emitted.kinds],
    }),
    detection,
    detection_sufficient_cases: Number(detection.r8010) + Number(detection.r8011) + Number(detection.r8029),
  };
}
