import { assignSpecialistDomain, isWrongDomainAssignment } from "./domain-assignment.ts";
import { scoreContraryEvidence } from "./contrary-evidence.ts";
import {
  evaluateFieldTransfusion,
  evaluatePamelaForeshadowing,
  verifyFindingAgainstManuscript,
} from "./manuscript-verification.ts";
import type {
  CrossExpertAuditInput,
  CrossExpertContradiction,
  CrossExpertDuplicate,
  CrossExpertFindingAdjudication,
  CrossExpertNormalizedFinding,
  CrossExpertQualityGrades,
  ManuscriptVerificationResult,
} from "./types.ts";

function decideForFinding(args: {
  readonly finding: CrossExpertNormalizedFinding;
  readonly verification: ManuscriptVerificationResult;
  readonly duplicateOf: string | null;
  readonly contradictionIds: readonly string[];
  readonly domainWrong: boolean;
  readonly contraryIrrelevantRatio: number;
  readonly contraryScores: readonly import("./types.ts").ContraryEvidenceScore[];
}): CrossExpertFindingAdjudication {
  const assignment = assignSpecialistDomain(args.finding);
  let decision: CrossExpertFindingAdjudication["decision"] =
    args.finding.source === "literary_agent" ? "retain" : "retain";
  let rationale =
    args.finding.source === "literary_agent"
      ? "Literary Agent editorial issue retained for consolidated revision planning."
      : "Finding is supported by manuscript evidence and domain fit.";

  if (args.duplicateOf) {
    decision = "duplicate_merge";
    rationale = `Duplicate of ${args.duplicateOf}.`;
  } else if (args.finding.source === "literary_agent") {
    decision = "retain";
    rationale = "Literary Agent editorial issue retained for consolidated revision planning.";
  } else if (/pamela|foreshadow/i.test(args.finding.title) && args.verification.markers.length > 0) {
    const found = args.verification.markers.filter((m) => m.found).length;
    if (found / args.verification.markers.length >= 0.7) {
      decision = "reject_false_positive";
      rationale = "Manuscript contains extensive Pamela betrayal foreshadowing; concern is not supported.";
    }
  } else if (args.verification.recommendationAlreadyPresent) {
    decision = "reject_false_positive";
    rationale = "Recommendation duplicates existing manuscript content.";
  } else if (/blood|transfusion|donation/i.test(args.finding.title) && args.verification.recommendationAlreadyPresent) {
    decision = "reject_false_positive";
    rationale = "Field transfusion recommendation duplicates existing manuscript medical detail.";
  } else if (/blood|transfusion|donation/i.test(args.finding.title) && args.verification.recommendationOverlapRatio >= 0.35) {
    decision = "downgrade";
    rationale = "Medical realism markers are largely present; only minor clarification may remain.";
  } else if (!args.verification.evidenceSupported && args.contraryIrrelevantRatio >= 0.5) {
    decision = "insufficient_evidence";
    rationale = "Evidence weak and contrary citations do not materially weaken the concern.";
  } else if (!args.verification.evidenceSupported) {
    decision = "downgrade";
    rationale = "Manuscript evidence support is weak; retain only as advisory.";
  } else if (args.domainWrong) {
    decision = "reroute_to_specialist";
    rationale = `Best owned by ${assignment.assignedDomain}, not Military Expert alone.`;
  } else if (args.contraryIrrelevantRatio >= 0.5) {
    decision = "retain_with_revision";
    rationale = "Retain concern but revise contrary-evidence handling.";
  }

  return Object.freeze({
    findingKey: args.finding.findingKey,
    source: args.finding.source,
    title: args.finding.title,
    decision,
    assignedDomain: assignment.assignedDomain,
    manuscriptVerification: args.verification,
    contraryEvidenceScores: args.contraryScores,
    duplicateOf: args.duplicateOf,
    contradictionIds: args.contradictionIds,
    rationale,
  });
}

export function adjudicateFindings(args: {
  readonly input: CrossExpertAuditInput;
  readonly contradictions: readonly CrossExpertContradiction[];
  readonly duplicates: readonly CrossExpertDuplicate[];
}): readonly CrossExpertFindingAdjudication[] {
  const allFindings = [...args.input.literaryAgentFindings, ...args.input.militaryExpertFindings];
  const duplicateMap = new Map<string, string>();
  for (const dup of args.duplicates) {
    const [primary, secondary] = dup.findingKeys;
    if (primary && secondary) duplicateMap.set(secondary, primary);
  }

  const contradictionMap = new Map<string, string[]>();
  for (const contradiction of args.contradictions) {
    for (const key of contradiction.relatedFindingKeys) {
      const existing = contradictionMap.get(key) ?? [];
      contradictionMap.set(key, [...existing, contradiction.id]);
    }
  }

  return allFindings.map((finding) => {
    const verification = verifyFindingAgainstManuscript({
      finding,
      manuscriptText: args.input.manuscriptText,
    });
    const contraryScores = scoreContraryEvidence({
      finding,
      manuscriptText: args.input.manuscriptText,
    });
    const contraryIrrelevantRatio =
      contraryScores.length === 0
        ? 0
        : contraryScores.filter((score) => score.quality === "irrelevant" || score.quality === "supports_concern")
            .length / contraryScores.length;
    const assignment = assignSpecialistDomain(finding);
    const domainWrong = isWrongDomainAssignment(finding, assignment);

    return decideForFinding({
      finding,
      verification,
      duplicateOf: duplicateMap.get(finding.findingKey) ?? null,
      contradictionIds: Object.freeze(contradictionMap.get(finding.findingKey) ?? []),
      domainWrong,
      contraryIrrelevantRatio,
      contraryScores,
    });
  });
}

export function computeQualityGrades(args: {
  readonly input: CrossExpertAuditInput;
  readonly adjudications: readonly CrossExpertFindingAdjudication[];
}): CrossExpertQualityGrades {
  const laScore = args.input.literaryAgentScore;
  const laLetter = args.input.literaryAgentLetterGrade ?? "—";
  const meFindings = args.adjudications.filter((a) => a.source === "military_expert");
  const retained = meFindings.filter((a) => a.decision === "retain" || a.decision === "retain_with_revision").length;
  const meScore = meFindings.length === 0 ? null : Math.round((retained / meFindings.length) * 100);
  const meRejected = meFindings.filter(
    (a) => a.decision === "reject_false_positive" || a.decision === "insufficient_evidence",
  ).length;
  const meEffective = meFindings.length === 0 ? null : Math.round(((meFindings.length - meRejected) / meFindings.length) * 100);
  const combined =
    laScore == null || meEffective == null ? null : Math.round(((laScore + meEffective) / 2) * 10) / 10;

  return Object.freeze({
    literaryAgent: Object.freeze({
      score: laScore,
      letter: laLetter,
      grade: laScore == null ? "Ungraded" : `${laLetter} (${laScore})`,
    }),
    militaryExpert: Object.freeze({
      score: meEffective,
      letter: meEffective == null ? "—" : meEffective >= 80 ? "B" : meEffective >= 65 ? "C" : "D",
      grade: meEffective == null ? "Ungraded" : `${meEffective}/100 audit-retained`,
    }),
    combinedTeam: Object.freeze({
      score: combined,
      letter: combined == null ? "—" : combined >= 80 ? "B" : combined >= 65 ? "C" : "D",
      grade: combined == null ? "Ungraded" : `${combined} composite`,
    }),
  });
}

export function buildMandatoryCaseResults(args: {
  readonly input: CrossExpertAuditInput;
  readonly contradictions: readonly CrossExpertContradiction[];
  readonly adjudications: readonly CrossExpertFindingAdjudication[];
  readonly contraryScores: readonly import("./types.ts").ContraryEvidenceScore[];
  readonly domainAssignments: readonly import("./types.ts").DomainAssignmentResult[];
  readonly tacticalDomains: readonly import("./types.ts").TacticalCoverageDomain[];
}): CrossExpertAuditReportMandatoryCases {
  const pamelaScan = evaluatePamelaForeshadowing(args.input.manuscriptText);
  const transfusionScan = evaluateFieldTransfusion(args.input.manuscriptText);
  const pamelaAdjudication = args.adjudications.find(
    (a) => a.source === "military_expert" && /pamela|foreshadow/i.test(a.title),
  );
  const transfusionAdjudication = args.adjudications.find(
    (a) => a.source === "military_expert" && /blood|transfusion|donation/i.test(a.title),
  );
  const pamelaContradiction = args.contradictions.find((c) => c.id === "pamela-foreshadowing");

  return Object.freeze({
    pamelaForeshadowing: Object.freeze({
      literaryAgentPosition: "Pamela/Mira conspiracy is fairly and effectively seeded.",
      militaryExpertPosition: "Pamela's dual-agent status is insufficiently foreshadowed.",
      manuscriptMarkerCoverage: pamelaScan.coverageRatio,
      markersFound: pamelaScan.foundCount,
      markersTotal: pamelaScan.totalCount,
      betterSupportedExpert:
        pamelaScan.coverageRatio >= 0.7 ? "literary_agent" : "military_expert",
      adjudication: pamelaAdjudication?.decision ?? "insufficient_evidence",
      contradictionId: pamelaContradiction?.id ?? null,
    }),
    fieldTransfusion: Object.freeze({
      militaryExpertRecommendation: "Add O-negative verification and citrate realism detail.",
      manuscriptMarkerCoverage: transfusionScan.coverageRatio,
      markersFound: transfusionScan.foundCount,
      markersTotal: transfusionScan.totalCount,
      recommendationDuplicatesExistingContent: transfusionScan.coverageRatio >= 0.6,
      adjudication: transfusionAdjudication?.decision ?? "insufficient_evidence",
    }),
    contraryEvidenceQuality: Object.freeze({
      totalScored: args.contraryScores.length,
      breakdown: args.contraryScores.reduce<Record<string, number>>((acc, score) => {
        acc[score.quality] = (acc[score.quality] ?? 0) + 1;
        return acc;
      }, {}),
    }),
    domainAssignment: Object.freeze({
      totalFindings: args.domainAssignments.length,
      assignments: args.domainAssignments,
      wrongDomainCount: args.domainAssignments.filter((a) => a.assignedDomain !== "Military Expert" && !a.sharedWithMilitaryExpert).length,
    }),
    tacticalCoverageGaps: Object.freeze({
      domains: args.tacticalDomains,
      missedDomains: args.tacticalDomains.filter((d) => !d.covered).map((d) => d.label),
      coverageRatio:
        args.tacticalDomains.length === 0
          ? 0
          : args.tacticalDomains.filter((d) => d.covered).length / args.tacticalDomains.length,
    }),
  });
}

interface CrossExpertAuditReportMandatoryCases {
  readonly pamelaForeshadowing: Record<string, unknown>;
  readonly fieldTransfusion: Record<string, unknown>;
  readonly contraryEvidenceQuality: Record<string, unknown>;
  readonly domainAssignment: Record<string, unknown>;
  readonly tacticalCoverageGaps: Record<string, unknown>;
}

export function applyContradictionWinners(args: {
  readonly contradictions: CrossExpertContradiction[];
  readonly pamelaCoverageRatio: number;
  readonly transfusionCoverageRatio: number;
}): CrossExpertContradiction[] {
  return args.contradictions.map((contradiction) => {
    if (contradiction.id !== "pamela-foreshadowing") return contradiction;
    return Object.freeze({
      ...contradiction,
      betterSupportedExpert:
        args.pamelaCoverageRatio >= 0.7 ? ("literary_agent" as const) : ("military_expert" as const),
      rationale:
        args.pamelaCoverageRatio >= 0.7
          ? "Manuscript foreshadowing markers strongly support Literary Agent."
          : "Manuscript foreshadowing markers support Military Expert concern.",
    });
  });
}
