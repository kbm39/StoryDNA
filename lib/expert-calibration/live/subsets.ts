import { createHash } from "node:crypto";
import type { LiveCalibrationSubsetDefinition, LiveCalibrationSubsetId } from "./contracts.ts";
import { MILITARY_EXPERT_CALIBRATION_SUITE } from "@/experts/military-expert/calibration/corpus.ts";

function hashCaseIds(caseIds: readonly string[]): string {
  const sorted = [...caseIds].sort();
  return createHash("sha256").update(sorted.join("\n")).digest("hex");
}

const ALL_CASE_IDS = MILITARY_EXPERT_CALIBRATION_SUITE.cases.map((c) => c.case_id);

const SUBSET_CASE_IDS: Record<LiveCalibrationSubsetId, readonly string[]> = Object.freeze({
  military_expert_smoke_v1: Object.freeze(["me-coc-001", "me-coc-002", "me-ops-004"]),
  military_expert_core_v1: Object.freeze([
    "me-coc-001",
    "me-coc-002",
    "me-coc-003",
    "me-wpn-001",
    "me-wpn-002",
    "me-wpn-003",
    "me-ops-001",
    "me-ops-002",
    "me-log-001",
    "me-log-002",
    "me-int-002",
    "me-roe-002",
  ]),
  military_expert_safety_v1: Object.freeze([
    "me-ops-004",
    "me-ops-005",
    "me-int-003",
    "me-trap-001",
    "me-trap-002",
    "me-hp-003",
  ]),
  military_expert_ambiguity_v1: Object.freeze([
    "me-coc-004",
    "me-coc-005",
    "me-rank-001",
    "me-ops-003",
    "me-log-003",
    "me-int-001",
    "me-roe-001",
    "me-ovr-001",
  ]),
  military_expert_full_v1: Object.freeze([...ALL_CASE_IDS]),
  military_expert_stability_v1: Object.freeze([
    "me-coc-001",
    "me-coc-002",
    "me-int-001",
    "me-ops-003",
    "me-trap-001",
  ]),
});

const SUBSET_TITLES: Record<LiveCalibrationSubsetId, string> = {
  military_expert_smoke_v1: "Smoke subset — wiring, parse, safety gate",
  military_expert_core_v1: "Core accuracy — clear error vs accurate scenes",
  military_expert_safety_v1: "Safety — traps, fabrication, duplicates, escalation",
  military_expert_ambiguity_v1: "Ambiguity — insufficient evidence, human adjudication",
  military_expert_full_v1: "Full 34-case certification gate",
  military_expert_stability_v1: "Stability — hash agreement across reps",
};

const SUBSET_PURPOSES: Record<LiveCalibrationSubsetId, string> = {
  military_expert_smoke_v1: "Gate 1 wiring validation",
  military_expert_core_v1: "Gate 3 precision/recall",
  military_expert_safety_v1: "Gate 2 safety compliance",
  military_expert_ambiguity_v1: "Gate 4 uncertainty handling",
  military_expert_full_v1: "Gate 6 full certification",
  military_expert_stability_v1: "Gate 5 stability audit",
};

function buildSubset(subsetId: LiveCalibrationSubsetId): LiveCalibrationSubsetDefinition {
  const caseIds = SUBSET_CASE_IDS[subsetId];
  return Object.freeze({
    subsetId,
    title: SUBSET_TITLES[subsetId],
    caseIds,
    subsetHash: hashCaseIds(caseIds),
    purpose: SUBSET_PURPOSES[subsetId],
  });
}

export const LIVE_CALIBRATION_SUBSETS: Readonly<Record<LiveCalibrationSubsetId, LiveCalibrationSubsetDefinition>> =
  Object.freeze({
    military_expert_smoke_v1: buildSubset("military_expert_smoke_v1"),
    military_expert_core_v1: buildSubset("military_expert_core_v1"),
    military_expert_safety_v1: buildSubset("military_expert_safety_v1"),
    military_expert_ambiguity_v1: buildSubset("military_expert_ambiguity_v1"),
    military_expert_full_v1: buildSubset("military_expert_full_v1"),
    military_expert_stability_v1: buildSubset("military_expert_stability_v1"),
  });

export const LIVE_CALIBRATION_SUBSET_IDS = Object.freeze(
  Object.keys(LIVE_CALIBRATION_SUBSETS) as LiveCalibrationSubsetId[],
);

export function getLiveCalibrationSubset(
  subsetId: LiveCalibrationSubsetId,
): LiveCalibrationSubsetDefinition {
  return LIVE_CALIBRATION_SUBSETS[subsetId];
}

export function isLiveCalibrationSubsetId(value: string): value is LiveCalibrationSubsetId {
  return value in LIVE_CALIBRATION_SUBSETS;
}

export function hashLiveCalibrationSubsetCaseIds(caseIds: readonly string[]): string {
  return hashCaseIds(caseIds);
}

export function validateSubsetCaseIds(caseIds: readonly string[]): {
  ok: boolean;
  unknown: readonly string[];
} {
  const known = new Set(ALL_CASE_IDS);
  const unknown = caseIds.filter((id) => !known.has(id));
  return { ok: unknown.length === 0, unknown };
}
