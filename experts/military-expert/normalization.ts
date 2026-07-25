/**
 * Deterministic Military Expert review normalization — safe transforms only.
 */

import {
  MILITARY_EXPERT_MAX_EVIDENCE_EXCERPT_WORDS,
  MILITARY_EXPERT_SEVERITY_LEVELS,
  type MilitaryExpertCategoryAssessment,
  type MilitaryExpertFinding,
  type MilitaryExpertReview,
} from "./contracts.ts";

const SEVERITY_RANK: Record<(typeof MILITARY_EXPERT_SEVERITY_LEVELS)[number], number> = {
  critical: 0,
  major: 1,
  moderate: 2,
  minor: 3,
  informational: 4,
};

function trim(value: string | undefined): string {
  return value?.trim() ?? "";
}

function truncateExcerpt(excerpt: string): string {
  const words = excerpt.trim().split(/\s+/).filter(Boolean);
  if (words.length <= MILITARY_EXPERT_MAX_EVIDENCE_EXCERPT_WORDS) {
    return words.join(" ");
  }
  return words.slice(0, MILITARY_EXPERT_MAX_EVIDENCE_EXCERPT_WORDS).join(" ");
}

function normalizeFinding(finding: MilitaryExpertFinding, index: number): MilitaryExpertFinding {
  const stableId =
    finding.finding_id?.trim() ||
    `${finding.category}:${finding.title.trim().toLowerCase()}:${index + 1}`;

  return {
    ...finding,
    finding_id: stableId,
    title: trim(finding.title),
    observation: trim(finding.observation),
    evidence_location: trim(finding.evidence_location) || undefined,
    operational_impact: trim(finding.operational_impact),
    story_impact: trim(finding.story_impact),
    recommendation: trim(finding.recommendation),
    preservation_note: trim(finding.preservation_note),
    uncertainty_note: trim(finding.uncertainty_note) || undefined,
    source_requirements: trim(finding.source_requirements) || undefined,
    manuscript_evidence: (finding.manuscript_evidence ?? []).map((record) => ({
      ...record,
      excerpt: truncateExcerpt(record.excerpt),
      locator: trim(record.locator) || undefined,
      verification_note: trim(record.verification_note) || undefined,
    })),
    contrary_evidence: finding.contrary_evidence?.map((record) => ({
      ...record,
      excerpt: truncateExcerpt(record.excerpt),
      locator: trim(record.locator) || undefined,
      verification_note: trim(record.verification_note) || undefined,
    })),
    author_challenge_allowed: true,
  };
}

function sortFindings(findings: MilitaryExpertFinding[]): MilitaryExpertFinding[] {
  return [...findings].sort((a, b) => {
    const severityDelta = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (severityDelta !== 0) return severityDelta;
    const categoryDelta = a.category.localeCompare(b.category);
    if (categoryDelta !== 0) return categoryDelta;
    return (a.evidence_location ?? "").localeCompare(b.evidence_location ?? "");
  });
}

function deriveCategoryAssessment(
  category: MilitaryExpertCategoryAssessment["category"],
  findings: MilitaryExpertFinding[],
): MilitaryExpertCategoryAssessment {
  const categoryFindings = findings.filter((finding) => finding.category === category);
  const criticalCount = categoryFindings.filter((finding) => finding.severity === "critical").length;
  const majorCount = categoryFindings.filter((finding) => finding.severity === "major").length;

  return {
    category,
    status: "mixed",
    confidence: "medium",
    strength_summary: "",
    concern_summary: "",
    finding_count: categoryFindings.length,
    critical_count: criticalCount,
    major_count: majorCount,
    verification_needed: categoryFindings.some(
      (finding) => finding.realism_status === "context_dependent",
    ),
    evidence_coverage: categoryFindings.length > 0 ? "partial" : "none",
  };
}

export function normalizeMilitaryExpertReview(review: MilitaryExpertReview): MilitaryExpertReview {
  const normalizedFindings = sortFindings(review.findings.map(normalizeFinding));

  const categoryAssessments = review.category_assessments.map((assessment) => {
    const derived = deriveCategoryAssessment(assessment.category, normalizedFindings);
    return {
      ...assessment,
      category: assessment.category,
      status: assessment.status,
      confidence: assessment.confidence,
      strength_summary: trim(assessment.strength_summary),
      concern_summary: trim(assessment.concern_summary),
      finding_count: derived.finding_count,
      critical_count: derived.critical_count,
      major_count: derived.major_count,
      verification_needed: assessment.verification_needed ?? derived.verification_needed,
      evidence_coverage: trim(assessment.evidence_coverage) || derived.evidence_coverage,
    };
  });

  return {
    ...review,
    summary: trim(review.summary),
    strengths: review.strengths.map((item) => trim(item)).filter(Boolean),
    findings: normalizedFindings,
    category_assessments: categoryAssessments,
    critical_issues: review.critical_issues.map((item) => trim(item)).filter(Boolean),
    priority_actions: review.priority_actions.map((item) => trim(item)).filter(Boolean),
    verification_requests: review.verification_requests.map((item) => trim(item)).filter(Boolean),
    escalation_recommendations: review.escalation_recommendations
      .map((item) => trim(item))
      .filter(Boolean),
    uncertainty_summary: trim(review.uncertainty_summary),
    next_step: trim(review.next_step),
    overall_realism_assessment: {
      ...review.overall_realism_assessment,
      conclusion: trim(review.overall_realism_assessment.conclusion),
      primary_strengths: review.overall_realism_assessment.primary_strengths
        .map((item) => trim(item))
        .filter(Boolean),
      primary_concerns: review.overall_realism_assessment.primary_concerns
        .map((item) => trim(item))
        .filter(Boolean),
      preservation_priorities: review.overall_realism_assessment.preservation_priorities
        .map((item) => trim(item))
        .filter(Boolean),
    },
    author_challenge_supported: true,
  };
}
