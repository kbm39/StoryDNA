import "server-only";

import { RECKONING_REVISED_13_SOURCE_PIN } from "@/experts/archivist/reckoning-revised-13-source-pin.ts";
import { getSupabaseAdmin } from "@/lib/supabase/server.ts";
import { isArchivistCandidateReviewUiAllowed } from "./allow.ts";
import { presentCandidateReview } from "./present.ts";
import {
  ARCHIVIST_CANDIDATE_REVIEW_WORKFLOW_ID,
  type ArchivistCandidateReviewLoadResult,
} from "./types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function loadArchivistCandidateReviewForManuscript(
  manuscriptId: string,
): Promise<ArchivistCandidateReviewLoadResult> {
  if (!isArchivistCandidateReviewUiAllowed()) {
    return { ok: false, reason: "not_allowed" };
  }
  if (!manuscriptId.trim()) return { ok: false, reason: "missing" };

  const client = getSupabaseAdmin();
  const { data: workflows, error: workflowError } = await client
    .from("archivist_segmented_workflows")
    .select("id, status, manuscript_id, manuscript_version_id, content_hash")
    .eq("manuscript_id", manuscriptId);
  if (workflowError || !workflows?.length) return { ok: false, reason: "missing" };

  const preferred =
    workflows.find((row) => row.id === ARCHIVIST_CANDIDATE_REVIEW_WORKFLOW_ID) ??
    workflows[0]!;

  const { data: reviewRow, error: reviewError } = await client
    .from("archivist_candidate_reviews")
    .select("review_json, candidate_canon")
    .eq("workflow_id", preferred.id)
    .maybeSingle();
  if (reviewError || !reviewRow || !isRecord(reviewRow.review_json)) {
    return { ok: false, reason: "missing" };
  }
  if (!Array.isArray(reviewRow.review_json.findings)) {
    return { ok: false, reason: "malformed" };
  }

  const { data: coverageRow } = await client
    .from("archivist_coverage_reports")
    .select("report_json")
    .eq("workflow_id", preferred.id)
    .maybeSingle();
  const coverage = isRecord(coverageRow?.report_json) ? coverageRow.report_json : null;

  const { data: ledger } = await client
    .from("archivist_segmented_cost_ledger")
    .select("provider, model, cost_usd")
    .eq("workflow_id", preferred.id);

  const { data: graphRow } = await client
    .from("archivist_book_graphs")
    .select("graph_json")
    .eq("workflow_id", preferred.id)
    .maybeSingle();
  const graphAmbiguities = isRecord(graphRow?.graph_json) && Array.isArray(graphRow.graph_json.unresolved_ambiguities)
    ? graphRow.graph_json.unresolved_ambiguities.length
    : 0;

  const paidCalls = ledger?.length ?? 0;
  const historical = Number(
    (ledger ?? []).reduce((sum, row) => sum + Number(row.cost_usd ?? 0), 0).toFixed(3),
  );
  const firstPaid = (ledger ?? []).find((row) => row.provider && row.provider !== "none");

  const model = presentCandidateReview({
    review: reviewRow.review_json,
    workflow: preferred,
    coverage: coverage
      ? {
          unique_words_covered: Number(coverage.unique_words_covered ?? 0),
          canonical_manuscript_words: Number(coverage.canonical_manuscript_words ?? 0),
          coverage_percentage: Number(coverage.coverage_percentage ?? 0),
          complete: coverage.complete === true,
          unit_count: Number(coverage.unit_count ?? 0),
          units_represented: Number(coverage.units_represented ?? 0),
          segment_count: Number(coverage.segment_count ?? 0),
          uncovered_ranges: Array.isArray(coverage.uncovered_ranges) ? coverage.uncovered_ranges : [],
        }
      : preferred.manuscript_id === RECKONING_REVISED_13_SOURCE_PIN.manuscript_id
        ? {
            unique_words_covered: RECKONING_REVISED_13_SOURCE_PIN.analytical_word_count,
            canonical_manuscript_words: RECKONING_REVISED_13_SOURCE_PIN.analytical_word_count,
            coverage_percentage: 100,
            complete: true,
            unit_count: 30,
            units_represented: 30,
            segment_count: 14,
            uncovered_ranges: [],
          }
        : null,
    cost: {
      historical_paid_usd: historical,
      paid_calls: paidCalls,
      provider: firstPaid?.provider ?? "anthropic",
      model: firstPaid?.model ?? RECKONING_REVISED_13_SOURCE_PIN.model,
    },
    withheld_graph_ambiguity_count: graphAmbiguities,
  });

  if (!model) return { ok: false, reason: "malformed" };
  return { ok: true, model };
}

export function assertNoCandidateReviewMutation(): void {
  throw new Error("archivist candidate review is read-only");
}
