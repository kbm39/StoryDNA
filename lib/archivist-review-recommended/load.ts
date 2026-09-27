import "server-only";

import { RECKONING_REVISED_13_SOURCE_PIN } from "@/experts/archivist/reckoning-revised-13-source-pin.ts";
import {
  collectPhase1ReviewCandidates,
  presentReviewRecommendedModel,
  type PresentedReviewRecommendedModel,
} from "@/experts/archivist/segmented/observation-v2/review-recommended/index.ts";
import { loadSavedDa1cb4fbObservations } from "@/experts/archivist/segmented/observation-v2/review-recommended/replay-da1cb4fb.ts";
import { isArchivistCandidateReviewUiAllowed } from "@/lib/archivist-candidate-review/allow.ts";
import { createFileReviewDecisionStore } from "./store.ts";

export function loadArchivistReviewRecommendedForManuscript(
  manuscriptId: string,
):
  | { ok: true; model: PresentedReviewRecommendedModel }
  | { ok: false; reason: "missing" | "not_allowed" } {
  if (!isArchivistCandidateReviewUiAllowed()) {
    return { ok: false, reason: "not_allowed" };
  }
  if (manuscriptId !== RECKONING_REVISED_13_SOURCE_PIN.manuscript_id) {
    return { ok: false, reason: "missing" };
  }
  const saved = loadSavedDa1cb4fbObservations();
  if (!saved.ok) return { ok: false, reason: "missing" };
  const decisions = createFileReviewDecisionStore();
  const candidates = collectPhase1ReviewCandidates({
    observations: saved.observations,
    manuscriptId: saved.manuscript_id,
    manuscriptVersionId: saved.manuscript_version_id,
    sourceWorkflowId: saved.workflow_id,
    decisions,
  });
  return {
    ok: true,
    model: presentReviewRecommendedModel({
      manuscriptId: saved.manuscript_id,
      manuscriptVersionId: saved.manuscript_version_id,
      sourceWorkflowId: saved.workflow_id,
      candidates,
    }),
  };
}
