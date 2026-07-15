import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommercialRubricPayload } from "../commercial-fiction-rubric.ts";
import { selectPriorReviewCandidate } from "./select-prior-review.ts";
import type { ComparisonMode } from "./types.ts";
import type {
  EditorialIssueRecord,
  PriorReviewBundle,
  RevisionCandidateRecord,
} from "./types.ts";
import type { PriorReviewCandidate } from "./select-prior-review.ts";

export interface PriorReviewLoadResult {
  gateRequired: boolean;
  priorReviewId: string | null;
  priorVersionId: string | null;
  currentVersionId: string | null;
  priorContentHash: string | null;
  currentContentHash: string | null;
  comparison_mode: ComparisonMode;
  candidate_audit: PriorReviewCandidate[];
  same_version_grading_review_id: string | null;
  priorText: string | null;
  bundle: PriorReviewBundle | null;
  priorManuscriptScore: number | null;
}

/**
 * Load the best prior commercial review for gate comparison.
 * Prefers newest review on a differing manuscript version; falls back to same-version reassessment.
 */
export async function loadPriorReviewForGate(
  supabase: SupabaseClient,
  manuscriptId: string,
  currentVersionId: string | null,
): Promise<PriorReviewLoadResult> {
  const base: PriorReviewLoadResult = {
    gateRequired: false,
    priorReviewId: null,
    priorVersionId: null,
    currentVersionId,
    priorContentHash: null,
    currentContentHash: null,
    comparison_mode: "REVISION_COMPARISON",
    candidate_audit: [],
    same_version_grading_review_id: null,
    priorText: null,
    bundle: null,
    priorManuscriptScore: null,
  };

  let currentContentHash: string | null = null;
  if (currentVersionId) {
    const { data: currentVersion } = await supabase
      .from("manuscript_versions")
      .select("content_hash")
      .eq("id", currentVersionId)
      .maybeSingle();
    currentContentHash = (currentVersion?.content_hash as string | null) ?? null;
  }

  const { data: reviews, error } = await supabase
    .from("reviews")
    .select(
      "id, created_at, rubric_breakdown, content, manuscript_version_id, manuscript_score, lifecycle_status",
    )
    .eq("manuscript_id", manuscriptId)
    .eq("perspective", "commercial")
    .in("lifecycle_status", ["active", "superseded"])
    .order("created_at", { ascending: false });

  if (error || !reviews?.length) return { ...base, currentContentHash };

  const versionIds = [
    ...new Set(
      reviews
        .map((r) => r.manuscript_version_id as string | null)
        .filter((id): id is string => !!id),
    ),
  ];

  const versionMeta = new Map<
    string,
    { content_hash: string | null; word_count: number | null; created_at: string | null }
  >();
  if (versionIds.length > 0) {
    const { data: versions } = await supabase
      .from("manuscript_versions")
      .select("id, content_hash, word_count, created_at")
      .in("id", versionIds);
    for (const v of versions ?? []) {
      versionMeta.set(v.id as string, {
        content_hash: (v.content_hash as string | null) ?? null,
        word_count: v.word_count != null ? Number(v.word_count) : null,
        created_at: (v.created_at as string | null) ?? null,
      });
    }
  }

  const candidates: PriorReviewCandidate[] = reviews.map((r) => {
    const vid = (r.manuscript_version_id as string | null) ?? null;
    const meta = vid ? versionMeta.get(vid) : undefined;
    return {
      review_id: r.id as string,
      created_at: r.created_at as string,
      manuscript_version_id: vid,
      version_created_at: meta?.created_at ?? null,
      content_hash: meta?.content_hash ?? null,
      word_count: meta?.word_count ?? null,
      lifecycle_status: r.lifecycle_status as string,
      manuscript_score: r.manuscript_score != null ? Number(r.manuscript_score) : null,
    };
  });

  const selection = selectPriorReviewCandidate(candidates, currentVersionId);
  const selected = selection.selected;
  if (!selected?.manuscript_version_id) {
    return { ...base, currentContentHash, candidate_audit: selection.candidate_audit };
  }

  const reviewRow = reviews.find((r) => r.id === selected.review_id);
  if (!reviewRow) {
    return { ...base, currentContentHash, candidate_audit: selection.candidate_audit };
  }

  const priorVersionId = selected.manuscript_version_id;
  const { data: version } = await supabase
    .from("manuscript_versions")
    .select("extracted_text, content_hash")
    .eq("id", priorVersionId)
    .maybeSingle();

  const priorText = (version?.extracted_text as string | null)?.trim() ?? null;
  if (!priorText) {
    return { ...base, currentContentHash, candidate_audit: selection.candidate_audit };
  }

  const priorContentHash =
    selected.content_hash ?? (version?.content_hash as string | null) ?? null;

  const [issuesRes, candidatesRes] = await Promise.all([
    supabase
      .from("editorial_issues")
      .select("id, review_id, text, area, severity, source_section, success_criterion")
      .eq("manuscript_id", manuscriptId)
      .eq("review_id", selected.review_id),
    supabase
      .from("revision_candidates")
      .select("id, issue_id, original, revised, reason, locator")
      .eq("manuscript_id", manuscriptId),
  ]);

  const editorial_issues = (issuesRes.data ?? []) as EditorialIssueRecord[];
  const revision_candidates = (candidatesRes.data ?? []) as RevisionCandidateRecord[];

  const bundle: PriorReviewBundle = {
    review_id: selected.review_id,
    manuscript_version_id: priorVersionId,
    rubric_breakdown: (reviewRow.rubric_breakdown as CommercialRubricPayload | null) ?? null,
    memo_content: reviewRow.content as string,
    editorial_issues,
    revision_candidates,
  };

  return {
    gateRequired: true,
    priorReviewId: selected.review_id,
    priorVersionId,
    currentVersionId,
    priorContentHash,
    currentContentHash,
    comparison_mode: selection.comparison_mode,
    candidate_audit: selection.candidate_audit,
    same_version_grading_review_id: selection.same_version_grading_review_id,
    priorText,
    bundle,
    priorManuscriptScore: selected.manuscript_score,
  };
}
