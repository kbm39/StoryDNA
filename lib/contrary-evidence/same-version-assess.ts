import type {
  EvidenceSnippet,
  PriorConcern,
  SameVersionStatus,
  SearchResult,
  SemanticAssessorInput,
} from "./types.ts";
import { isBroadCriticism } from "./scoring-gate.ts";
import { normalizeRootIssueKey, rootIssueLabel } from "./normalize-root-issue.ts";
import type { ConcernAssessment } from "./types.ts";

export interface SameVersionAssessmentResult {
  status: SameVersionStatus;
  confidence: "high" | "medium" | "low";
  original_basis_still_present: boolean;
  narrowed_current_finding: string | null;
  explanation: string;
}

/**
 * Same-version reassessment — evaluates whether a prior deduction is still warranted
 * in the unchanged manuscript. Never claims revision or points restored by revision.
 */
export function assessSameVersionConcern(
  input: SemanticAssessorInput,
): SameVersionAssessmentResult {
  const { prior_concern, candidate_supporting } = input;

  if (prior_concern.prior_deduction <= 0) {
    return {
      status: "NOT_ASSESSABLE",
      confidence: "low",
      original_basis_still_present: false,
      narrowed_current_finding: null,
      explanation: "Prior concern was not scored; no carry-forward deduction.",
    };
  }

  const supporting = candidate_supporting.filter((s) => s.relevance === "supporting");
  const quotesLocated = prior_concern.prior_evidence.filter((q) =>
    candidate_supporting.some(
      (s) =>
        s.location === "prior_quotation_located" &&
        (s.text.includes(q.slice(0, 40)) || q.includes(s.text.slice(0, 40))),
    ),
  );

  const hasSupporting = supporting.length > 0 || quotesLocated.length > 0;

  if (!hasSupporting) {
    return {
      status: "UNSUPPORTED",
      confidence: "high",
      original_basis_still_present: false,
      narrowed_current_finding: null,
      explanation:
        "Prior deduction lacks locatable supporting evidence in this manuscript version.",
    };
  }

  if (isBroadCriticism(prior_concern.prior_criticism)) {
    const narrowed = narrowFinding(prior_concern.prior_criticism, supporting);
    return {
      status: "OVERBROAD",
      confidence: "medium",
      original_basis_still_present: true,
      narrowed_current_finding: narrowed,
      explanation:
        "Prior criticism is overbroad; any retained deduction must be narrowed to specific passages.",
    };
  }

  return {
    status: "SUPPORTED",
    confidence: "medium",
    original_basis_still_present: true,
    narrowed_current_finding: null,
    explanation: "Supporting evidence for the prior deduction is present in this version.",
  };
}

export function computeSameVersionDeductionAdjustment(
  priorDeduction: number,
  status: SameVersionStatus,
): {
  points_invalidated: number;
  duplicate_points_removed: number;
  overbreadth_points_removed: number;
  remaining_deduction: number;
  points_restored: number;
} {
  const zero = {
    points_invalidated: 0,
    duplicate_points_removed: 0,
    overbreadth_points_removed: 0,
    remaining_deduction: 0,
    points_restored: 0,
  };

  switch (status) {
    case "UNSUPPORTED":
    case "NOT_ASSESSABLE":
      return { ...zero, points_invalidated: priorDeduction };
    case "DUPLICATED":
      return { ...zero, duplicate_points_removed: priorDeduction };
    case "OVERBROAD": {
      const remaining = Math.max(0, Math.round(priorDeduction * 0.5 * 100) / 100);
      return {
        ...zero,
        overbreadth_points_removed: priorDeduction - remaining,
        remaining_deduction: remaining,
      };
    }
    case "SUPPORTED":
      return { ...zero, remaining_deduction: priorDeduction };
    default:
      return zero;
  }
}

export function composeSameVersionAssessment(
  concern: PriorConcern,
  search: SearchResult,
  semantic: SameVersionAssessmentResult,
): import("./types.ts").ConcernAssessment {
  const adj = computeSameVersionDeductionAdjustment(concern.prior_deduction, semantic.status);

  let narrowed = semantic.narrowed_current_finding;
  if (
    semantic.status === "OVERBROAD" &&
    !narrowed &&
    isBroadCriticism(concern.prior_criticism)
  ) {
    narrowed = narrowFinding(
      concern.prior_criticism,
      search.current_supporting_evidence.filter((s) => s.relevance === "supporting"),
    );
  }

  const contrary_evidence_analysis = buildSameVersionContraryAnalysis(search, semantic.status);

  return {
    comparison_mode: "SAME_VERSION_REASSESSMENT",
    concern_id: concern.concern_id,
    root_issue: concern.root_issue,
    rubric_category: concern.rubric_category,
    prior_criticism: concern.prior_criticism,
    prior_evidence: concern.prior_evidence,
    current_supporting_evidence: search.current_supporting_evidence,
    current_contrary_evidence: search.current_contrary_evidence,
    revision_that_addresses_it: null,
    original_basis_still_present: semantic.original_basis_still_present,
    status: semantic.status,
    confidence: semantic.confidence,
    prior_deduction: concern.prior_deduction,
    points_restored: 0,
    points_invalidated: adj.points_invalidated,
    duplicate_points_removed: adj.duplicate_points_removed,
    overbreadth_points_removed: adj.overbreadth_points_removed,
    remaining_deduction: adj.remaining_deduction,
    narrowed_current_finding: narrowed,
    explanation: semantic.explanation,
    contrary_evidence_analysis,
  };
}

function narrowFinding(criticism: string, supporting: EvidenceSnippet[]): string | null {
  const excerpt = supporting.find((s) => s.relevance === "supporting")?.text;
  if (!excerpt) return null;
  const trimmed = excerpt.slice(0, 100).replace(/\s+/g, " ").trim();
  return `Narrowed: ${criticism.slice(0, 60)} — evidence at: "${trimmed}…"`;
}

function buildSameVersionContraryAnalysis(
  search: SearchResult,
  status: SameVersionStatus,
): string {
  const contrary = search.current_contrary_evidence.filter((c) => c.relevance === "contrary");
  if (contrary.length > 0) {
    return contrary
      .slice(0, 2)
      .map((c) => `${c.location ?? "?"}: ${c.text.slice(0, 80)}`)
      .join(" | ");
  }
  if (status === "SUPPORTED" || status === "OVERBROAD") {
    return "Same-version review: supporting passages reviewed; no mitigating contrary evidence required.";
  }
  return "";
}

/** Mark secondary concerns sharing a root issue as DUPLICATED (same-version mode only). */
export function markSameVersionDuplicates(assessments: ConcernAssessment[]): ConcernAssessment[] {
  if (assessments.length === 0) return assessments;
  if (assessments[0].comparison_mode !== "SAME_VERSION_REASSESSMENT") return assessments;

  const byRoot = new Map<string, ConcernAssessment[]>();
  for (const a of assessments) {
    const key = normalizeRootIssueKey(a.root_issue);
    const list = byRoot.get(key) ?? [];
    list.push(a);
    byRoot.set(key, list);
  }

  const updated = assessments.map((a) => ({ ...a }));

  for (const [rootKey, group] of byRoot) {
    if (rootKey === "unknown" || group.length <= 1) continue;

    const sorted = [...group].sort((a, b) => {
      if (b.remaining_deduction !== a.remaining_deduction) {
        return b.remaining_deduction - a.remaining_deduction;
      }
      return a.concern_id.localeCompare(b.concern_id);
    });

    for (let i = 1; i < sorted.length; i++) {
      const prior = sorted[i];
      const idx = updated.findIndex((a) => a.concern_id === prior.concern_id);
      if (idx === -1 || updated[idx].status === "DUPLICATED") continue;

      const adj = computeSameVersionDeductionAdjustment(prior.prior_deduction, "DUPLICATED");
      updated[idx] = {
        ...updated[idx],
        status: "DUPLICATED",
        points_restored: 0,
        points_invalidated: adj.points_invalidated,
        duplicate_points_removed: adj.duplicate_points_removed || prior.prior_deduction,
        overbreadth_points_removed: 0,
        remaining_deduction: 0,
        explanation: `Duplicate root issue "${rootIssueLabel(rootKey)}"; only one deduction may apply.`,
      };
    }
  }

  return updated;
}
