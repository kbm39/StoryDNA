import {
  adjudicateFindings,
  applyContradictionWinners,
  buildMandatoryCaseResults,
  computeQualityGrades,
} from "./adjudicate.ts";
import { assignSpecialistDomain } from "./domain-assignment.ts";
import { scoreContraryEvidence } from "./contrary-evidence.ts";
import {
  buildExpertOverlapMatrix,
  detectDirectContradictions,
  detectDuplicateFindings,
} from "./detection.ts";
import { evaluatePamelaForeshadowing } from "./manuscript-verification.ts";
import { evaluateTacticalCoverage, summarizeTacticalCoverage } from "./tactical-coverage.ts";
import type { CrossExpertAuditInput, CrossExpertAuditReport } from "./types.ts";

export const CROSS_EXPERT_AUDIT_VERSION = "cross_expert_adjudication_v1" as const;

export function runCrossExpertAdjudicationAudit(input: CrossExpertAuditInput): CrossExpertAuditReport {
  const overlapMatrix = buildExpertOverlapMatrix({
    literaryAgentFindings: input.literaryAgentFindings,
    militaryExpertFindings: input.militaryExpertFindings,
  });

  let contradictions = detectDirectContradictions({
    literaryAgentFindings: input.literaryAgentFindings,
    militaryExpertFindings: input.militaryExpertFindings,
    literaryAgentReviewContent: input.literaryAgentReviewContent,
  });

  const pamelaScan = evaluatePamelaForeshadowing(input.manuscriptText);
  contradictions = applyContradictionWinners({
    contradictions: [...contradictions],
    pamelaCoverageRatio: pamelaScan.coverageRatio,
    transfusionCoverageRatio: 0,
  });

  const duplicates = detectDuplicateFindings([
    ...input.literaryAgentFindings,
    ...input.militaryExpertFindings,
  ]);

  const adjudications = adjudicateFindings({ input, contradictions, duplicates });
  const grades = computeQualityGrades({ input, adjudications });

  const perFindingVerification = adjudications
    .map((a) => a.manuscriptVerification)
    .filter((v): v is NonNullable<typeof v> => v !== null);

  const contraryScores = input.militaryExpertFindings.flatMap((finding) =>
    scoreContraryEvidence({ finding, manuscriptText: input.manuscriptText }),
  );

  const domainAssignments = input.militaryExpertFindings.map((finding) =>
    assignSpecialistDomain(finding),
  );

  const tacticalDomains = evaluateTacticalCoverage({
    manuscriptText: input.manuscriptText,
    militaryExpertFindings: input.militaryExpertFindings,
  });
  const tacticalSummary = summarizeTacticalCoverage(tacticalDomains);

  const mandatoryCases = buildMandatoryCaseResults({
    input,
    contradictions,
    adjudications,
    contraryScores,
    domainAssignments,
    tacticalDomains,
  });

  const falsePositiveList = adjudications.filter((a) => a.decision === "reject_false_positive");
  const retained = adjudications.filter(
    (a) => a.decision === "retain" || a.decision === "retain_with_revision",
  );
  const rejected = adjudications.filter(
    (a) => a.decision === "reject_false_positive" || a.decision === "insufficient_evidence",
  );
  const rerouted = adjudications.filter((a) => a.decision === "reroute_to_specialist");
  const wrongDomainCount = domainAssignments.filter(
    (a) => a.assignedDomain !== "Military Expert" && !a.sharedWithMilitaryExpert,
  ).length;

  const missedIssues = tacticalSummary.missedDomains.map((label) =>
    Object.freeze({ label, source: "tactical_coverage_gap" }),
  );

  const consolidatedRevisionRecommendations = retained.map((a) =>
    Object.freeze({
      findingKey: a.findingKey,
      title: a.title,
      decision: a.decision,
      assignedDomain: a.assignedDomain,
      rationale: a.rationale,
    }),
  );

  const certificationRecommendation =
    wrongDomainCount > 0 || contradictions.length > 0
      ? "Do not certify Military Expert commercially until cross-expert contradictions are resolved and domain-routed findings are reviewed by assigned specialists."
      : "Military Expert may proceed to internal Kevin Studio recalibration; commercial certification still blocked.";

  return Object.freeze({
    auditVersion: CROSS_EXPERT_AUDIT_VERSION,
    generatedAt: new Date().toISOString(),
    readOnly: true as const,
    input: Object.freeze({
      manuscriptId: input.manuscriptId,
      manuscriptVersionId: input.manuscriptVersionId,
      manuscriptTitle: input.manuscriptTitle,
      wordCount: input.wordCount,
      literaryAgentReviewId: input.literaryAgentReviewId,
      militaryExpertReviewId: input.militaryExpertReviewId,
    }),
    sections: Object.freeze({
      reviewMetadata: Object.freeze({
        book: input.manuscriptTitle,
        manuscriptId: input.manuscriptId,
        manuscriptVersionId: input.manuscriptVersionId,
        wordCount: input.wordCount,
        literaryAgentReviewId: input.literaryAgentReviewId,
        militaryExpertReviewId: input.militaryExpertReviewId,
        literaryAgentFindingCount: input.literaryAgentFindings.length,
        militaryExpertFindingCount: input.militaryExpertFindings.length,
      }),
      expertOverlapMatrix: overlapMatrix,
      directContradictionMatrix: contradictions,
      perFindingManuscriptVerification: perFindingVerification,
      contraryEvidenceScorecard: contraryScores,
      domainAssignmentScorecard: domainAssignments,
      duplicateFindingList: duplicates,
      falsePositiveList,
      missedIssueList: missedIssues,
      consolidatedRevisionRecommendations,
      literaryAgentQualityGrade: grades.literaryAgent,
      militaryExpertQualityGrade: grades.militaryExpert,
      combinedTeamQualityGrade: grades.combinedTeam,
      certificationRecommendation,
    }),
    mandatoryCases,
    adjudications,
    summary: Object.freeze({
      directContradictionCount: contradictions.length,
      duplicateFindingCount: duplicates.length,
      falsePositiveCount: falsePositiveList.length,
      wrongDomainCount,
      retainedCount: retained.length,
      rejectedCount: rejected.length,
      reroutedCount: rerouted.length,
      downgradedCount: adjudications.filter((a) => a.decision === "downgrade").length,
    }),
    immutability: input.immutabilitySnapshots,
  });
}
