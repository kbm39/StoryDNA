import type {
  ConcernAssessment,
  PriorConcern,
  SearchResult,
  SemanticAssessmentResult,
  SemanticAssessor,
  SemanticAssessorInput,
} from "./types.ts";
import { isBroadCriticism } from "./scoring-gate.ts";

export function buildSemanticAssessorInput(
  concern: PriorConcern,
  search: SearchResult,
  genreProfile: import("./types.ts").GenreProfile,
): SemanticAssessorInput {
  return {
    prior_concern: concern,
    prior_evidence: concern.prior_evidence,
    candidate_supporting: search.current_supporting_evidence,
    candidate_contrary: search.current_contrary_evidence,
    revision_notes: search.revision_changes,
    version_diff_evidence: search.version_diff,
    rubric_category: concern.rubric_category,
    genre_profile: genreProfile,
  };
}

/**
 * Rule-based deterministic assessor for Phase 1.
 * Keyword hits alone never set nuanced literary status — they only supply candidates.
 */
export function assessConcernDeterministic(input: SemanticAssessorInput): SemanticAssessmentResult {
  const {
    prior_concern,
    candidate_supporting,
    candidate_contrary,
    revision_notes,
    version_diff_evidence,
  } = input;

  const deletedQuotes = prior_concern.prior_evidence.filter((q) => {
    const found = candidate_supporting.some(
      (s) => s.location === "prior_quotation_located" && s.text.includes(q.slice(0, 40)),
    );
    const deleted = candidate_contrary.some(
      (c) => c.location === "quotation_deleted" && c.text.includes(q.slice(0, 40)),
    );
    return !found && deleted;
  });

  const allQuotesDeleted =
    prior_concern.prior_evidence.length > 0 &&
    deletedQuotes.length === prior_concern.prior_evidence.length;

  const supportingCount = countRelevance(candidate_supporting, "supporting");
  const contraryCount = countRelevance(candidate_contrary, "contrary");
  const hasRevision = revision_notes.length > 0;
  const hasMaterialAdditions = version_diff_evidence.additions.length > 0;

  if (allQuotesDeleted && supportingCount === 0) {
    if (contraryCount >= 1 && (hasRevision || hasMaterialAdditions)) {
      return {
        status: "RESOLVED",
        confidence: "high",
        original_basis_still_present: false,
        narrowed_current_finding: null,
        revision_that_addresses_it: revision_notes[0] ?? null,
        explanation: "Prior quoted basis removed and replaced with revised material.",
      };
    }
    return {
      status: "STALE_CRITIQUE",
      confidence: "high",
      original_basis_still_present: false,
      narrowed_current_finding: null,
      revision_that_addresses_it: revision_notes[0] ?? null,
      explanation: "Prior quoted evidence is absent from the current manuscript.",
    };
  }

  const worsened = detectWorsened(input, supportingCount, contraryCount);
  if (worsened) {
    return {
      status: "WORSENED",
      confidence: "medium",
      original_basis_still_present: true,
      narrowed_current_finding: null,
      revision_that_addresses_it: null,
      explanation: "Additional passages in the current manuscript reinforce the prior criticism.",
    };
  }

  if (contraryCount >= 2 && supportingCount === 0 && (hasRevision || hasMaterialAdditions)) {
    return {
      status: "RESOLVED",
      confidence: "high",
      original_basis_still_present: false,
      narrowed_current_finding: null,
      revision_that_addresses_it: revision_notes[0] ?? null,
      explanation: "Revision removed or replaced the criticized basis; contrary evidence dominates with no current support.",
    };
  }

  if (contraryCount > supportingCount && hasRevision) {
    return {
      status: "SUBSTANTIALLY_IMPROVED",
      confidence: "medium",
      original_basis_still_present: false,
      narrowed_current_finding: null,
      revision_that_addresses_it: revision_notes[0] ?? null,
      explanation: "Documented revision changes address the prior criticism with stronger contrary than supporting signals.",
    };
  }

  if (contraryCount > 0 && supportingCount > 0 && hasRevision) {
    return {
      status: "PARTIALLY_IMPROVED",
      confidence: "medium",
      original_basis_still_present: true,
      narrowed_current_finding: narrowFinding(prior_concern.prior_criticism, candidate_supporting),
      revision_that_addresses_it: revision_notes[0] ?? null,
      explanation: "Some improvement detected, but supporting evidence for the original basis remains.",
    };
  }

  if (supportingCount > contraryCount && supportingCount > 0) {
    return {
      status: "UNCHANGED",
      confidence: "medium",
      original_basis_still_present: true,
      narrowed_current_finding: null,
      revision_that_addresses_it: null,
      explanation: "Current manuscript still contains supporting evidence for the prior criticism.",
    };
  }

  if (contraryCount > 0 && supportingCount > 0 && contraryCount >= supportingCount) {
    return {
      status: "WORSENED",
      confidence: "medium",
      original_basis_still_present: true,
      narrowed_current_finding: null,
      revision_that_addresses_it: null,
      explanation: "Contrary indicators suggest the criticized issue has intensified.",
    };
  }

  return {
    status: "NOT_ASSESSABLE",
    confidence: "low",
    original_basis_still_present: false,
    narrowed_current_finding: null,
    revision_that_addresses_it: null,
    explanation: "Insufficient deterministic signals; semantic assessor required.",
  };
}

export function createFixtureAssessor(
  overrides: Record<string, Partial<SemanticAssessmentResult>>,
): SemanticAssessor {
  return {
    assess(input: SemanticAssessorInput): SemanticAssessmentResult {
      const override = overrides[input.prior_concern.concern_id];
      const base = assessConcernDeterministic(input);
      if (!override) return base;
      return { ...base, ...override };
    },
  };
}

export function composeConcernAssessment(
  concern: PriorConcern,
  search: SearchResult,
  semantic: SemanticAssessmentResult,
): ConcernAssessment {
  const { points_restored, remaining_deduction } = computeDeductionAdjustment(
    concern.prior_deduction,
    semantic.status,
  );

  let narrowed_current_finding = semantic.narrowed_current_finding;
  if (
    remaining_deduction > 0 &&
    isBroadCriticism(concern.prior_criticism) &&
    !narrowed_current_finding
  ) {
    narrowed_current_finding = narrowFinding(concern.prior_criticism, search.current_supporting_evidence);
  }

  const contrary_evidence_analysis = buildContraryAnalysis(search, {
    ...semantic,
    narrowed_current_finding,
  });

  return {
    comparison_mode: "REVISION_COMPARISON",
    concern_id: concern.concern_id,
    root_issue: concern.root_issue,
    rubric_category: concern.rubric_category,
    prior_criticism: concern.prior_criticism,
    prior_evidence: concern.prior_evidence,
    current_supporting_evidence: search.current_supporting_evidence,
    current_contrary_evidence: search.current_contrary_evidence,
    revision_that_addresses_it: semantic.revision_that_addresses_it,
    original_basis_still_present: semantic.original_basis_still_present,
    status: semantic.status,
    confidence: semantic.confidence,
    prior_deduction: concern.prior_deduction,
    points_restored,
    points_invalidated: 0,
    duplicate_points_removed: 0,
    overbreadth_points_removed: 0,
    remaining_deduction,
    narrowed_current_finding,
    explanation: semantic.explanation,
    contrary_evidence_analysis,
  };
}

export function computeDeductionAdjustment(
  priorDeduction: number,
  status: SemanticAssessmentResult["status"],
): { points_restored: number; remaining_deduction: number } {
  if (status === "RESOLVED" || status === "STALE_CRITIQUE") {
    return { points_restored: priorDeduction, remaining_deduction: 0 };
  }
  if (status === "SUBSTANTIALLY_IMPROVED") {
    const remaining = Math.max(0, Math.round(priorDeduction * 0.25 * 100) / 100);
    return { points_restored: priorDeduction - remaining, remaining_deduction: remaining };
  }
  if (status === "PARTIALLY_IMPROVED") {
    const remaining = Math.max(0, Math.round(priorDeduction * 0.5 * 100) / 100);
    return { points_restored: priorDeduction - remaining, remaining_deduction: remaining };
  }
  if (status === "WORSENED") {
    const remaining = Math.min(priorDeduction * 1.25, priorDeduction + 1);
    return { points_restored: 0, remaining_deduction: remaining };
  }
  if (status === "UNCHANGED") {
    return { points_restored: 0, remaining_deduction: priorDeduction };
  }
  return { points_restored: 0, remaining_deduction: 0 };
}

function detectWorsened(
  input: SemanticAssessorInput,
  supportingCount: number,
  contraryCount: number,
): boolean {
  if (supportingCount === 0) return false;
  const issue = input.prior_concern.root_issue.toLowerCase();
  const issueWords = issue.split(/\s+/).filter((w) => w.length > 4).slice(0, 4);
  if (issueWords.length === 0) return false;

  const countMatches = (snippets: import("./types.ts").EvidenceSnippet[]) =>
    snippets.filter(
      (s) =>
        s.relevance === "supporting" &&
        issueWords.filter((w) => s.text.toLowerCase().includes(w)).length >= 2,
    ).length;

  const supportingMatches = countMatches(input.candidate_supporting);
  const diffAdditions = input.version_diff_evidence.additions.filter((a) =>
    issueWords.filter((w) => a.toLowerCase().includes(w)).length >= 2,
  );

  return diffAdditions.length > 0 && supportingMatches > 0 && contraryCount <= supportingCount;
}

function countRelevance(
  snippets: import("./types.ts").EvidenceSnippet[],
  relevance: import("./types.ts").EvidenceSnippet["relevance"],
): number {
  return snippets.filter((s) => s.relevance === relevance).length;
}

function narrowFinding(criticism: string, supporting: import("./types.ts").EvidenceSnippet[]): string | null {
  const excerpt = supporting.find((s) => s.relevance === "supporting")?.text;
  if (!excerpt) return null;
  const trimmed = excerpt.slice(0, 120).replace(/\s+/g, " ").trim();
  return `Residual issue (narrowed): ${criticism.slice(0, 80)} — still visible in: "${trimmed}…"`;
}

function buildContraryAnalysis(
  search: SearchResult,
  semantic: SemanticAssessmentResult,
): string {
  const contrary = search.current_contrary_evidence;
  if (contrary.length > 0) {
    const parts = contrary.slice(0, 3).map((c) => c.text.slice(0, 100));
    return `Contrary signals (${semantic.status}): ${parts.join(" | ")}`;
  }
  if (
    semantic.status === "UNCHANGED" ||
    semantic.status === "WORSENED" ||
    semantic.status === "PARTIALLY_IMPROVED"
  ) {
    return `Contrary-evidence review completed; no mitigating contrary passages identified (${semantic.status}).`;
  }
  return "";
}
