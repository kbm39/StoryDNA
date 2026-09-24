import { manuscriptPassageLocated } from "@/lib/passage-locate.ts";
import type { ArchivistEvidenceRecord, ArchivistFinding } from "../contracts.ts";
import { evidenceIsLocated } from "../evidence.ts";
import { recoverContiguousManuscriptPassage } from "./contiguous-passage-recovery.ts";

export function rehydrateEvidenceRecord(args: {
  record: ArchivistEvidenceRecord;
  manuscriptText: string;
  manuscript_id: string;
  manuscript_version_id: string;
  content_hash: string;
  value?: Record<string, unknown>;
}): ArchivistEvidenceRecord {
  const belongsToVersion =
    (!args.record.manuscript_id || args.record.manuscript_id === args.manuscript_id) &&
    (!args.record.manuscript_version_id ||
      args.record.manuscript_version_id === args.manuscript_version_id) &&
    (!args.record.content_hash || args.record.content_hash === args.content_hash);
  let excerpt = args.record.excerpt;
  if (excerpt?.trim() && !manuscriptPassageLocated(args.manuscriptText, excerpt)) {
    const recovered = recoverContiguousManuscriptPassage({
      excerpt,
      locator: args.record.locator,
      manuscriptText: args.manuscriptText,
      value: args.value,
    });
    if (recovered.class === "B") excerpt = recovered.excerpt;
  }
  const excerptExists = Boolean(excerpt?.trim());
  const locatorResolves = Boolean(args.record.locator?.trim());
  const matches = excerptExists && manuscriptPassageLocated(args.manuscriptText, excerpt);
  return {
    ...args.record,
    excerpt,
    manuscript_id: args.manuscript_id,
    manuscript_version_id: args.manuscript_version_id,
    content_hash: args.content_hash,
    verification_status: belongsToVersion && locatorResolves && matches ? "located" : "unverified",
  };
}

export function rehydrateFindingEvidence(args: {
  finding: ArchivistFinding;
  manuscriptText: string;
  manuscript_id: string;
  manuscript_version_id: string;
  content_hash: string;
}): ArchivistFinding {
  const current = args.finding.current_evidence.map((record) =>
    rehydrateEvidenceRecord({ ...args, record }),
  );
  const conflicting = args.finding.conflicting_evidence.map((record) =>
    rehydrateEvidenceRecord({ ...args, record }),
  );
  return {
    ...args.finding,
    current_evidence: current,
    conflicting_evidence: conflicting,
  };
}

export function findingHasRehydratedBothSides(finding: ArchivistFinding): boolean {
  const currentOk = finding.current_evidence.some(
    (record) => record.evidence_role === "current_observation" && evidenceIsLocated(record),
  );
  const conflictingOk = finding.conflicting_evidence.some(
    (record) =>
      (record.evidence_role === "conflicting_canon" || record.evidence_role === "contrary") &&
      evidenceIsLocated(record),
  );
  return currentOk && conflictingOk;
}

export function downgradeUnrehydratedConfirmed(finding: ArchivistFinding): ArchivistFinding {
  if (finding.classification !== "confirmed_contradiction") return finding;
  if (findingHasRehydratedBothSides(finding)) return finding;
  return {
    ...finding,
    classification: "possible_continuity_conflict",
    final_classification: "possible_continuity_conflict",
    confirmation_eligibility: "insufficient_evidence",
    classification_adjustment_reason: "evidence_could_not_be_rehydrated",
  };
}
