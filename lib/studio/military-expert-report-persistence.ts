/**
 * In-memory Military Expert report persistence contract for Studio workflows.
 */

import type {
  MilitaryExpertFinding,
  MilitaryExpertReview,
} from "@/experts/military-expert/contracts.ts";
import {
  serializeMilitaryExpertFindingContent,
  type PersistedMilitaryExpertFindingContent,
  type PersistedMilitaryExpertV2FindingProvenance,
} from "@/lib/studio/military-expert-finding-content.ts";

export interface SavedMilitaryExpertFindingRecord {
  readonly findingId: string;
  readonly findingIndex: number;
  readonly findingStatus: "validated" | "author_review_required";
  readonly title: string;
  readonly category: string;
  readonly realismStatus: string;
  readonly severity: string;
  readonly confidence: string;
  readonly missingConfidenceFields: readonly ("contrary_evidence" | "uncertainty_note")[];
  readonly findingContent: PersistedMilitaryExpertFindingContent;
  readonly v2Provenance?: PersistedMilitaryExpertV2FindingProvenance;
}

export interface SavedMilitaryExpertReport {
  readonly reviewStatus: MilitaryExpertReview["review_status"];
  readonly parsedReviewHash: string;
  readonly manuscriptVersionId: string;
  readonly findings: readonly SavedMilitaryExpertFindingRecord[];
  readonly validatedFindingCount: number;
  readonly authorReviewRequiredCount: number;
}

export function prepareSavedMilitaryExpertReport(args: {
  review: MilitaryExpertReview;
  parsedReviewHash: string;
  unresolvedMissingFieldsByIndex?: ReadonlyMap<number, readonly ("contrary_evidence" | "uncertainty_note")[]>;
  v2ProvenanceByFindingId?: ReadonlyMap<string, PersistedMilitaryExpertV2FindingProvenance>;
}): SavedMilitaryExpertReport {
  const findings = args.review.findings.map((finding, index) =>
    toSavedFinding(
      finding,
      index,
      args.unresolvedMissingFieldsByIndex?.get(index) ?? [],
      args.v2ProvenanceByFindingId?.get(finding.finding_id),
    ),
  );

  const authorReviewRequiredCount = findings.filter(
    (item) => item.findingStatus === "author_review_required",
  ).length;

  return Object.freeze({
    reviewStatus: args.review.review_status,
    parsedReviewHash: args.parsedReviewHash,
    manuscriptVersionId: args.review.manuscript_version_id,
    findings,
    validatedFindingCount: findings.length - authorReviewRequiredCount,
    authorReviewRequiredCount,
  });
}

function toSavedFinding(
  finding: MilitaryExpertFinding,
  index: number,
  missingConfidenceFields: readonly ("contrary_evidence" | "uncertainty_note")[],
  v2Provenance?: PersistedMilitaryExpertV2FindingProvenance,
): SavedMilitaryExpertFindingRecord {
  const findingStatus =
    finding.finding_status === "author_review_required" ? "author_review_required" : "validated";

  return Object.freeze({
    findingId: finding.finding_id,
    findingIndex: index,
    findingStatus,
    title: finding.title,
    category: finding.category,
    realismStatus: finding.realism_status,
    severity: finding.severity,
    confidence: finding.confidence,
    missingConfidenceFields,
    findingContent: serializeMilitaryExpertFindingContent(finding, missingConfidenceFields, v2Provenance),
    v2Provenance,
  });
}
