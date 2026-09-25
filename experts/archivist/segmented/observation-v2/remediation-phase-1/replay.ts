/**
 * $0 replay of the nine already-consumed real-prose cases.
 * Names results replay_*. Does not mutate official_* scores.
 */

import { existsSync, readFileSync } from "node:fs";
import { adaptV2ProviderOutput } from "../adapter.ts";
import {
  BREADTH_DETECTION_FNS,
  V2_REAL_BREADTH_R8001_SEGMENT_ID,
  V2_REAL_BREADTH_R8007_SEGMENT_ID,
  V2_REAL_BREADTH_R8012_SEGMENT_ID,
  V2_REAL_BREADTH_R8016_SEGMENT_ID,
  V2_REAL_BREADTH_R8023_SEGMENT_ID,
  V2_REAL_BREADTH_R8025_SEGMENT_ID,
  V2_REAL_BREADTH_SESSION_ID,
} from "../calibration-real-reckoning-breadth-v1/index.ts";
import {
  REAL_BREADTH_OFFICIAL_METRICS,
  REAL_BREADTH_PRIOR_REAL_PROSE,
} from "../calibration-real-reckoning-breadth-v1/official.ts";
import {
  V2_REAL_CAL_R8010_SEGMENT_ID,
  V2_REAL_CAL_R8011_SEGMENT_ID,
  V2_REAL_CAL_R8029_SEGMENT_ID,
  V2_REAL_RECKONING_CAL_V1_SESSION_ID,
  r8010DetectionSufficient,
  r8011DetectionSufficient,
  r8029DetectionSufficient,
} from "../calibration-real-reckoning-v1/index.ts";
import { REAL_RECKONING_OFFICIAL_METRICS } from "../calibration-real-reckoning-v1/replay.ts";
import type { V2Observation } from "../types.ts";
import { V2_REMEDIATION_PHASE1_CONSUMED_IDS } from "./lock.ts";

export const PHASE1_REPLAY_MODE = "replay_saved_nine_consumed_real_prose" as const;

type OfficialDetection = "SUFFICIENT" | "INSUFFICIENT";

type DetectionFn = (retained: readonly V2Observation[]) => boolean;

const BREADTH_SEGMENTS = {
  "R8-001": V2_REAL_BREADTH_R8001_SEGMENT_ID,
  "R8-007": V2_REAL_BREADTH_R8007_SEGMENT_ID,
  "R8-012": V2_REAL_BREADTH_R8012_SEGMENT_ID,
  "R8-016": V2_REAL_BREADTH_R8016_SEGMENT_ID,
  "R8-023": V2_REAL_BREADTH_R8023_SEGMENT_ID,
  "R8-025": V2_REAL_BREADTH_R8025_SEGMENT_ID,
} as const;

const PRIOR_SEGMENTS = {
  "R8-010": V2_REAL_CAL_R8010_SEGMENT_ID,
  "R8-011": V2_REAL_CAL_R8011_SEGMENT_ID,
  "R8-029": V2_REAL_CAL_R8029_SEGMENT_ID,
} as const;

const PRIOR_DETECTION: Record<keyof typeof PRIOR_SEGMENTS, DetectionFn> = {
  "R8-010": r8010DetectionSufficient,
  "R8-011": r8011DetectionSufficient,
  "R8-029": r8029DetectionSufficient,
};

const RAW_KEYS: Record<(typeof V2_REMEDIATION_PHASE1_CONSUMED_IDS)[number], string> = {
  "R8-001": "r8001",
  "R8-007": "r8007",
  "R8-010": "r8010",
  "R8-011": "r8011",
  "R8-012": "r8012",
  "R8-016": "r8016",
  "R8-023": "r8023",
  "R8-025": "r8025",
  "R8-029": "r8029",
};

function priorOfficialDetection(id: "R8-010" | "R8-011" | "R8-029"): OfficialDetection {
  return REAL_BREADTH_PRIOR_REAL_PROSE.cases[id];
}

function officialDetection(id: (typeof V2_REMEDIATION_PHASE1_CONSUMED_IDS)[number]): OfficialDetection {
  if (id in PRIOR_SEGMENTS) return priorOfficialDetection(id as "R8-010" | "R8-011" | "R8-029");
  return REAL_BREADTH_OFFICIAL_METRICS.cases[id as keyof typeof REAL_BREADTH_OFFICIAL_METRICS.cases];
}

function loadJson(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function windowProse(windows: Record<string, unknown> | null, rawKey: string): string | null {
  const root = windows?.windows;
  if (!root || typeof root !== "object") return null;
  const row = (root as Record<string, { prose?: string }>)[rawKey];
  return typeof row?.prose === "string" ? row.prose : null;
}

function finishReason(artifact: Record<string, unknown> | null, rawKey: string): string | null {
  const call = artifact?.[`call_${rawKey}`];
  if (call && typeof call === "object" && "finish_reason" in call) {
    const value = (call as { finish_reason?: unknown }).finish_reason;
    return typeof value === "string" ? value : null;
  }
  return null;
}

export interface Phase1ReplayCase {
  benchmark_id: (typeof V2_REMEDIATION_PHASE1_CONSUMED_IDS)[number];
  artifact_available: boolean;
  official_detection: OfficialDetection;
  replay_detection: OfficialDetection | null;
  change: "improved" | "regressed" | "no_change" | "unavailable";
  reason: string;
  replay_retained: number;
  replay_hard_failure: string | null;
  truncation_recovery_method: string | null;
  complete_objects_recovered: number | null;
}

export interface Phase1NineCaseReplay {
  replay_mode: typeof PHASE1_REPLAY_MODE;
  provider_calls: 0;
  incremental_cost_usd: 0;
  official_breadth_unrewritten: typeof REAL_BREADTH_OFFICIAL_METRICS.verdict;
  official_prior_unrewritten: typeof REAL_RECKONING_OFFICIAL_METRICS.verdict;
  cases: Phase1ReplayCase[];
  replay_r8_001: {
    complete_objects_recovered: number | null;
    timestamp_kinds_recovered: number | null;
    clocks_in_recovered_prefix: {
      "0210": boolean | null;
      "02:10": boolean | null;
      "2:14": boolean | null;
      "2:31": boolean | null;
    };
    evidence_valid_timestamp_clocks: string[];
    timestamp_evidence: Array<{
      id: string;
      clock: string;
      status: "retained" | "quarantined";
      evidence_status: string | null;
      evidence_match_method: string | null;
      normalized_punctuation: boolean | null;
      excerpt: string;
    }>;
    required_0210_confirmation_grade: boolean | null;
    required_214_confirmation_grade: boolean | null;
    replay_detection: OfficialDetection | null;
  };
}

function detectionFn(id: (typeof V2_REMEDIATION_PHASE1_CONSUMED_IDS)[number]): DetectionFn {
  if (id in BREADTH_DETECTION_FNS) {
    return BREADTH_DETECTION_FNS[id as keyof typeof BREADTH_DETECTION_FNS];
  }
  return PRIOR_DETECTION[id as keyof typeof PRIOR_DETECTION];
}

function segmentIdFor(id: (typeof V2_REMEDIATION_PHASE1_CONSUMED_IDS)[number]): string {
  if (id in BREADTH_SEGMENTS) return BREADTH_SEGMENTS[id as keyof typeof BREADTH_SEGMENTS];
  return PRIOR_SEGMENTS[id as keyof typeof PRIOR_SEGMENTS];
}

export function replayNineConsumedRealProseCases(): Phase1NineCaseReplay {
  const breadth = loadJson(`.calibration-results/${V2_REAL_BREADTH_SESSION_ID}.json`);
  const breadthWindows = loadJson(`.calibration-results/${V2_REAL_BREADTH_SESSION_ID}.windows.json`);
  const prior = loadJson(`.calibration-results/${V2_REAL_RECKONING_CAL_V1_SESSION_ID}.json`);
  const priorWindows = loadJson(`.calibration-results/${V2_REAL_RECKONING_CAL_V1_SESSION_ID}.windows.json`);

  const cases: Phase1ReplayCase[] = [];
  let r8001Recovered: Phase1NineCaseReplay["replay_r8_001"] = {
    complete_objects_recovered: null,
    timestamp_kinds_recovered: null,
    clocks_in_recovered_prefix: { "0210": null, "02:10": null, "2:14": null, "2:31": null },
    evidence_valid_timestamp_clocks: [],
    timestamp_evidence: [],
    required_0210_confirmation_grade: null,
    required_214_confirmation_grade: null,
    replay_detection: null,
  };

  for (const id of V2_REMEDIATION_PHASE1_CONSUMED_IDS) {
    const official = officialDetection(id);
    const isPrior = id in PRIOR_SEGMENTS;
    const artifact = isPrior ? prior : breadth;
    const windows = isPrior ? priorWindows : breadthWindows;
    const rawKey = RAW_KEYS[id];
    const raw = (artifact?.raw as Record<string, string> | undefined)?.[rawKey];
    const prose = windowProse(windows, rawKey);
    if (!raw || !prose) {
      cases.push({
        benchmark_id: id,
        artifact_available: false,
        official_detection: official,
        replay_detection: null,
        change: "unavailable",
        reason: "saved official artifact or window missing",
        replay_retained: 0,
        replay_hard_failure: null,
        truncation_recovery_method: null,
        complete_objects_recovered: null,
      });
      continue;
    }

    const adapted = adaptV2ProviderOutput(raw, segmentIdFor(id), {
      segmentText: prose,
      finishReason: finishReason(artifact, rawKey),
    });
    const sufficient = detectionFn(id)(adapted.retained);
    const replayDetection: OfficialDetection = sufficient ? "SUFFICIENT" : "INSUFFICIENT";
    const change =
      official === replayDetection ? "no_change" : replayDetection === "SUFFICIENT" ? "improved" : "regressed";
    const reason = adapted.hard_failure
      ? `hard_fail:${adapted.hard_failure}`
      : sufficient
        ? "required sides retained after current adapter"
        : "required sides still missing or quarantined";

    if (id === "R8-001") {
      const recoveredText = raw;
      r8001Recovered = {
        complete_objects_recovered: adapted.truncation_recovery.complete_objects_recovered,
        timestamp_kinds_recovered: adapted.retained.filter((item) => item.kind === "timestamp").length,
        clocks_in_recovered_prefix: {
          "0210": recoveredText.includes("0210"),
          "02:10": recoveredText.includes("02:10"),
          "2:14": recoveredText.includes("2:14"),
          "2:31": recoveredText.includes("2:31"),
        },
        evidence_valid_timestamp_clocks: adapted.retained
          .filter((item) => item.kind === "timestamp")
          .map((item) => {
            const payload = item.payload as { raw_expression?: string; clock_time?: string };
            return payload.clock_time ?? payload.raw_expression ?? item.id;
          }),
        timestamp_evidence: [
          ...adapted.retained
            .filter((item) => item.kind === "timestamp")
            .map((item) => {
              const payload = item.payload as { raw_expression?: string; clock_time?: string };
              return {
                id: item.id,
                clock: payload.clock_time ?? payload.raw_expression ?? item.id,
                status: "retained" as const,
                evidence_status: item.evidence.evidence_status ?? null,
                evidence_match_method: item.evidence.evidence_match_method ?? null,
                normalized_punctuation: item.evidence.normalized_punctuation ?? null,
                excerpt: item.evidence.excerpt,
              };
            }),
          ...adapted.quarantined
            .filter((item) => item.kind === "timestamp")
            .map((item) => {
              const payload = item.observation?.payload as { raw_expression?: string; clock_time?: string } | undefined;
              return {
                id: item.observation_id ?? "timestamp",
                clock: payload?.clock_time ?? payload?.raw_expression ?? item.observation_id ?? "timestamp",
                status: "quarantined" as const,
                evidence_status: item.evidence_status ?? item.observation?.evidence.evidence_status ?? null,
                evidence_match_method: item.observation?.evidence.evidence_match_method ?? null,
                normalized_punctuation: item.observation?.evidence.normalized_punctuation ?? null,
                excerpt: item.excerpt ?? item.observation?.evidence.excerpt ?? "",
              };
            }),
        ],
        required_0210_confirmation_grade: adapted.retained.some((item) => {
          const text = `${item.evidence.excerpt} ${JSON.stringify(item.payload)}`.toLowerCase();
          return item.evidence.evidence_status === "verified" && text.includes("0210");
        }),
        required_214_confirmation_grade: adapted.retained.some((item) => {
          const text = `${item.evidence.excerpt} ${JSON.stringify(item.payload)}`.toLowerCase();
          return (
            item.evidence.evidence_status === "verified" &&
            (text.includes("2:14") || text.includes("02:14") || text.includes("0214"))
          );
        }),
        replay_detection: replayDetection,
      };
    }

    cases.push({
      benchmark_id: id,
      artifact_available: true,
      official_detection: official,
      replay_detection: replayDetection,
      change,
      reason,
      replay_retained: adapted.retained.length,
      replay_hard_failure: adapted.hard_failure,
      truncation_recovery_method: adapted.truncation_recovery.recovery_method,
      complete_objects_recovered: adapted.truncation_recovery.complete_objects_recovered,
    });
  }

  return {
    replay_mode: PHASE1_REPLAY_MODE,
    provider_calls: 0,
    incremental_cost_usd: 0,
    official_breadth_unrewritten: REAL_BREADTH_OFFICIAL_METRICS.verdict,
    official_prior_unrewritten: REAL_RECKONING_OFFICIAL_METRICS.verdict,
    cases,
    replay_r8_001: r8001Recovered,
  };
}

export function phase1ReplaySelectionIds(): readonly string[] {
  return V2_REMEDIATION_PHASE1_CONSUMED_IDS;
}
