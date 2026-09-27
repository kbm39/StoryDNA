/**
 * $0 replay of saved da1cb4fb observations.
 * Does not call a provider. Does not rewrite official reports.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { RECKONING_REVISED_13_SOURCE_PIN } from "../../../reckoning-revised-13-source-pin.ts";
import { countRepeatedObjectContinuityChains } from "../object-continuity.ts";
import { diagnoseAllV2Pairs } from "../opus-v2-full-manuscript-eval/runner.ts";
import type { V2Observation } from "../types.ts";
import { collectPhase1ReviewCandidates } from "./cluster.ts";
import { presentReviewRecommendedModel } from "./present.ts";
import type { ArchivistReviewDecisionStore } from "./types.ts";

export const DA1CB4FB_WORKFLOW_ID = "da1cb4fb-2f6d-4f6d-945b-eb0baa5cc12f" as const;
export const DA1CB4FB_RUN_STATE_RELATIVE =
  ".calibration-results/archivist-opus-v2-full-manuscript-eval-v3/run-state.json" as const;
export const DA1CB4FB_OFFICIAL_REPORT_RELATIVE =
  ".calibration-results/archivist-opus-v2-full-manuscript-eval-v3/report.json" as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function loadSavedDa1cb4fbObservations(root = process.cwd()): {
  ok: true;
  manuscript_id: string;
  manuscript_version_id: string;
  workflow_id: string;
  observations: V2Observation[];
} | { ok: false; reason: "missing" } {
  const path = join(root, DA1CB4FB_RUN_STATE_RELATIVE);
  if (!existsSync(path)) return { ok: false, reason: "missing" };
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!isRecord(raw) || !isRecord(raw.observations_by_segment)) {
    return { ok: false, reason: "missing" };
  }
  const observations: V2Observation[] = [];
  for (const rows of Object.values(raw.observations_by_segment)) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (isRecord(row) && typeof row.kind === "string") {
        observations.push(row as unknown as V2Observation);
      }
    }
  }
  return {
    ok: true,
    manuscript_id: RECKONING_REVISED_13_SOURCE_PIN.manuscript_id,
    manuscript_version_id: RECKONING_REVISED_13_SOURCE_PIN.manuscript_version_id,
    workflow_id: String(raw.workflow_id ?? DA1CB4FB_WORKFLOW_ID),
    observations,
  };
}

export function officialDa1cb4fbReportUnchanged(root = process.cwd()): {
  present: boolean;
  as_comparable: number | null;
  am_object_chains: number | null;
} {
  const path = join(root, DA1CB4FB_OFFICIAL_REPORT_RELATIVE);
  if (!existsSync(path)) return { present: false, as_comparable: null, am_object_chains: null };
  const report = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  return {
    present: true,
    as_comparable: Number(report.AS_comparable ?? null),
    am_object_chains: Number(report.AM_object_chains ?? null),
  };
}

export function replaySavedDa1cb4fbReviewRecommended(args?: {
  root?: string;
  decisions?: ArchivistReviewDecisionStore;
}) {
  const loaded = loadSavedDa1cb4fbObservations(args?.root);
  if (!loaded.ok) return { ok: false as const, reason: loaded.reason };
  const diagnoses = diagnoseAllV2Pairs(loaded.observations);
  const candidates = collectPhase1ReviewCandidates({
    observations: loaded.observations,
    manuscriptId: loaded.manuscript_id,
    manuscriptVersionId: loaded.manuscript_version_id,
    sourceWorkflowId: loaded.workflow_id,
    decisions: args?.decisions,
  });
  return {
    ok: true as const,
    workflow_id: loaded.workflow_id,
    observation_count: loaded.observations.length,
    as_comparable: diagnoses.filter((row) => row.eligibility === "comparable").length,
    am_object_chains: countRepeatedObjectContinuityChains(loaded.observations),
    review_recommended_cards: candidates.length,
    candidates,
    model: presentReviewRecommendedModel({
      manuscriptId: loaded.manuscript_id,
      manuscriptVersionId: loaded.manuscript_version_id,
      sourceWorkflowId: loaded.workflow_id,
      candidates,
    }),
    official_report: officialDa1cb4fbReportUnchanged(args?.root),
  };
}
