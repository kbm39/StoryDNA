/**
 * Archivist evidence profile — stricter than ordinary editorial commentary.
 * Confirmed contradictions require both-side located evidence. No fabricated quotes.
 */

import { manuscriptPassageLocated } from "@/lib/passage-locate.ts";
import type { ArchivistEvidenceRecord, ArchivistFinding } from "./contracts.ts";
import { ARCHIVIST_MAX_EVIDENCE_EXCERPT_WORDS } from "./contracts.ts";

export const ARCHIVIST_EVIDENCE_PROFILE = {
  profile_refs: ["EDITORIAL", "RESEARCH"] as const,
  confirmed_contradiction_minimum_records: 2,
  require_locator: true,
  require_verification: true,
  max_excerpt_words: ARCHIVIST_MAX_EVIDENCE_EXCERPT_WORDS,
  block_on_fabricated_quotes: true,
  author_can_locate_independently: true,
} as const;

export function countExcerptWords(excerpt: string): number {
  return excerpt.trim().split(/\s+/).filter(Boolean).length;
}

export function evidenceIsLocated(record: ArchivistEvidenceRecord): boolean {
  return (
    record.verification_status === "located" &&
    Boolean(record.locator?.trim()) &&
    Boolean(record.excerpt?.trim())
  );
}

export function currentSideEvidence(finding: ArchivistFinding): ArchivistEvidenceRecord[] {
  return (finding.current_evidence ?? []).filter(
    (record) => record.evidence_role === "current_observation" && evidenceIsLocated(record),
  );
}

export function conflictingSideEvidence(finding: ArchivistFinding): ArchivistEvidenceRecord[] {
  return (finding.conflicting_evidence ?? []).filter(
    (record) =>
      (record.evidence_role === "conflicting_canon" || record.evidence_role === "contrary") &&
      evidenceIsLocated(record),
  );
}

export function confirmedContradictionHasBothSides(finding: ArchivistFinding): boolean {
  const currentOk = currentSideEvidence(finding).length >= 1;
  const conflictingOk = conflictingSideEvidence(finding).length >= 1;
  const currentLocator = finding.current_location?.locator?.trim();
  const conflictingLocator = finding.conflicting_location?.locator?.trim();
  return Boolean(currentOk && conflictingOk && currentLocator && conflictingLocator);
}

export function verifyExcerptAgainstManuscript(
  excerpt: string,
  manuscriptText: string | undefined,
): boolean {
  if (!manuscriptText) return true;
  return manuscriptPassageLocated(manuscriptText, excerpt);
}

export function evidencePassesPassageVerification(
  record: ArchivistEvidenceRecord,
  manuscriptText: string | undefined,
): boolean {
  if (record.source_kind !== "manuscript") return true;
  if (!manuscriptText) return record.verification_status === "located";
  return verifyExcerptAgainstManuscript(record.excerpt, manuscriptText);
}
