/**
 * Live Archivist post-processing — constitution enforcement, not creative repair.
 *
 * May: downgrade confirmed findings that lack both-side located evidence,
 * fail passage verification, or use disjoint/unknown temporal relations.
 * Must not: invent quotations, coerce accepted canon to candidate, accept
 * Series Bible facts, approve retcons, dismiss conflicts, or author-dispose.
 */

import type { ArchivistFinding, ArchivistReview } from "./contracts.ts";
import {
  confirmedContradictionHasBothSides,
  evidencePassesPassageVerification,
} from "./evidence.ts";
import { normalizeArchivistReview } from "./normalization.ts";

function manuscriptEvidenceVerified(
  finding: ArchivistFinding,
  manuscriptText: string | undefined,
): boolean {
  const records = [...(finding.current_evidence ?? []), ...(finding.conflicting_evidence ?? [])];
  return records.every((record) => evidencePassesPassageVerification(record, manuscriptText));
}

function downgradeConfirmedFinding(
  finding: ArchivistFinding,
  manuscriptText: string | undefined,
): ArchivistFinding {
  if (finding.classification !== "confirmed_contradiction") return finding;

  const bothSides = confirmedContradictionHasBothSides(finding);
  const passagesOk = manuscriptEvidenceVerified(finding, manuscriptText);
  const relation = finding.temporal_analysis?.relation;
  const temporalBlocksConfirm = relation === "disjoint" || relation === "unknown";

  if (bothSides && passagesOk && !temporalBlocksConfirm) return finding;

  const hasAnyLocated =
    (finding.current_evidence?.length ?? 0) > 0 || (finding.conflicting_evidence?.length ?? 0) > 0;

  return {
    ...finding,
    classification: hasAnyLocated ? "possible_continuity_conflict" : "author_verification_needed",
  };
}

export function applyArchivistLivePostprocess(
  review: ArchivistReview,
  manuscriptText?: string,
): ArchivistReview {
  const findings = review.findings.map((finding) =>
    downgradeConfirmedFinding(finding, manuscriptText),
  );
  return normalizeArchivistReview({
    ...review,
    findings,
    generation: {
      ...review.generation,
      provider: "none",
      model: "none",
    },
  });
}

export function liveReviewEmitsAcceptedCanon(review: ArchivistReview): boolean {
  return review.canon_delta.some((delta) => (delta.status as string) !== "candidate");
}

export function liveReviewEmitsAuthorDisposition(review: ArchivistReview): boolean {
  return review.findings.some((finding) => finding.author_action !== "pending");
}
