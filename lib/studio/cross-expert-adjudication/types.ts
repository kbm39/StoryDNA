/** Cross-Expert Adjudication Audit — read-only Kevin Studio internal audit types. */

export const CROSS_EXPERT_ADJUDICATION_DECISIONS = [
  "retain",
  "retain_with_revision",
  "downgrade",
  "reroute_to_specialist",
  "reject_false_positive",
  "duplicate_merge",
  "insufficient_evidence",
] as const;

export type CrossExpertAdjudicationDecision = (typeof CROSS_EXPERT_ADJUDICATION_DECISIONS)[number];

export const SPECIALIST_DOMAINS = [
  "Military Expert",
  "Developmental Editor",
  "Thriller Editor",
  "Intelligence Expert",
  "Financial Crimes Expert",
  "Combat Medicine Expert",
  "Medical Expert",
  "Security/Construction Expert",
  "Literary Agent",
] as const;

export type SpecialistDomain = (typeof SPECIALIST_DOMAINS)[number];

export const CONTRARY_EVIDENCE_QUALITY = [
  "genuinely_weakens",
  "partially_relevant",
  "neutral",
  "irrelevant",
  "supports_concern",
] as const;

export type ContraryEvidenceQuality = (typeof CONTRARY_EVIDENCE_QUALITY)[number];

export type ExpertSource = "literary_agent" | "military_expert";

export interface CrossExpertNormalizedFinding {
  readonly findingKey: string;
  readonly source: ExpertSource;
  readonly sourceReviewId: string;
  readonly sourceFindingId: string | null;
  readonly title: string;
  readonly summary: string;
  readonly recommendation: string;
  readonly category: string;
  readonly severity: string;
  readonly confidence: string | null;
  readonly manuscriptEvidence: readonly { readonly excerpt: string; readonly locator?: string }[];
  readonly contraryEvidence: readonly { readonly excerpt: string; readonly locator?: string }[];
  readonly topicTokens: readonly string[];
}

export interface ManuscriptMarkerResult {
  readonly markerId: string;
  readonly label: string;
  readonly found: boolean;
  readonly matchCount: number;
}

export interface ManuscriptVerificationResult {
  readonly findingKey: string;
  readonly evidenceSupported: boolean;
  readonly evidenceSupportRatio: number;
  readonly recommendationAlreadyPresent: boolean;
  readonly recommendationOverlapRatio: number;
  readonly markers: readonly ManuscriptMarkerResult[];
  readonly rationale: string;
}

export interface DomainAssignmentResult {
  readonly findingKey: string;
  readonly assignedDomain: SpecialistDomain;
  readonly sharedWithMilitaryExpert: boolean;
  readonly rationale: string;
}

export interface ContraryEvidenceScore {
  readonly findingKey: string;
  readonly contraryIndex: number;
  readonly quality: ContraryEvidenceQuality;
  readonly rationale: string;
  readonly locator: string | null;
}

export interface CrossExpertContradiction {
  readonly id: string;
  readonly literaryAgentPosition: string;
  readonly militaryExpertPosition: string;
  readonly topic: string;
  readonly betterSupportedExpert: ExpertSource | "manuscript_neutral";
  readonly rationale: string;
  readonly relatedFindingKeys: readonly string[];
}

export interface CrossExpertDuplicate {
  readonly id: string;
  readonly findingKeys: readonly string[];
  readonly topic: string;
  readonly rationale: string;
}

export interface TacticalCoverageDomain {
  readonly domainId: string;
  readonly label: string;
  readonly covered: boolean;
  readonly relatedFindingKeys: readonly string[];
  readonly sceneSignals: readonly string[];
}

export interface CrossExpertFindingAdjudication {
  readonly findingKey: string;
  readonly source: ExpertSource;
  readonly title: string;
  readonly decision: CrossExpertAdjudicationDecision;
  readonly assignedDomain: SpecialistDomain;
  readonly manuscriptVerification: ManuscriptVerificationResult | null;
  readonly contraryEvidenceScores: readonly ContraryEvidenceScore[];
  readonly duplicateOf: string | null;
  readonly contradictionIds: readonly string[];
  readonly rationale: string;
}

export interface CrossExpertQualityGrades {
  readonly literaryAgent: { readonly score: number | null; readonly letter: string; readonly grade: string };
  readonly militaryExpert: { readonly score: number | null; readonly letter: string; readonly grade: string };
  readonly combinedTeam: { readonly score: number | null; readonly letter: string; readonly grade: string };
}

export interface CrossExpertAuditInput {
  readonly manuscriptId: string;
  readonly manuscriptVersionId: string;
  readonly manuscriptTitle: string;
  readonly wordCount: number;
  readonly manuscriptText: string;
  readonly literaryAgentReviewId: string;
  readonly militaryExpertReviewId: string;
  readonly literaryAgentFindings: readonly CrossExpertNormalizedFinding[];
  readonly militaryExpertFindings: readonly CrossExpertNormalizedFinding[];
  readonly literaryAgentReviewContent: string;
  readonly literaryAgentScore: number | null;
  readonly literaryAgentLetterGrade: string | null;
  readonly immutabilitySnapshots: CrossExpertImmutabilitySnapshots;
}

export interface CrossExpertImmutabilitySnapshots {
  readonly manuscriptContentHash: string;
  readonly literaryAgentReviewHash: string;
  readonly militaryExpertReviewHash: string;
  readonly literaryAgentIssueHashes: readonly string[];
  readonly militaryExpertFindingHashes: readonly string[];
}

export interface CrossExpertAuditReport {
  readonly auditVersion: string;
  readonly generatedAt: string;
  readonly readOnly: true;
  readonly input: {
    readonly manuscriptId: string;
    readonly manuscriptVersionId: string;
    readonly manuscriptTitle: string;
    readonly wordCount: number;
    readonly literaryAgentReviewId: string;
    readonly militaryExpertReviewId: string;
  };
  readonly sections: {
    readonly reviewMetadata: Record<string, unknown>;
    readonly expertOverlapMatrix: readonly Record<string, unknown>[];
    readonly directContradictionMatrix: readonly CrossExpertContradiction[];
    readonly perFindingManuscriptVerification: readonly ManuscriptVerificationResult[];
    readonly contraryEvidenceScorecard: readonly ContraryEvidenceScore[];
    readonly domainAssignmentScorecard: readonly DomainAssignmentResult[];
    readonly duplicateFindingList: readonly CrossExpertDuplicate[];
    readonly falsePositiveList: readonly CrossExpertFindingAdjudication[];
    readonly missedIssueList: readonly Record<string, unknown>[];
    readonly consolidatedRevisionRecommendations: readonly Record<string, unknown>[];
    readonly literaryAgentQualityGrade: CrossExpertQualityGrades["literaryAgent"];
    readonly militaryExpertQualityGrade: CrossExpertQualityGrades["militaryExpert"];
    readonly combinedTeamQualityGrade: CrossExpertQualityGrades["combinedTeam"];
    readonly certificationRecommendation: string;
  };
  readonly mandatoryCases: {
    readonly pamelaForeshadowing: Record<string, unknown>;
    readonly fieldTransfusion: Record<string, unknown>;
    readonly contraryEvidenceQuality: Record<string, unknown>;
    readonly domainAssignment: Record<string, unknown>;
    readonly tacticalCoverageGaps: Record<string, unknown>;
  };
  readonly adjudications: readonly CrossExpertFindingAdjudication[];
  readonly summary: {
    readonly directContradictionCount: number;
    readonly duplicateFindingCount: number;
    readonly falsePositiveCount: number;
    readonly wrongDomainCount: number;
    readonly retainedCount: number;
    readonly rejectedCount: number;
    readonly reroutedCount: number;
    readonly downgradedCount: number;
  };
  readonly immutability: CrossExpertImmutabilitySnapshots;
}
