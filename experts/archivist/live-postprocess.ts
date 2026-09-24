/**
 * Live Archivist post-processing — constitution enforcement, not creative repair.
 *
 * Order:
 * raw payload already parsed/enveloped
 * → deterministic entity resolution
 * → temporal/persistence evaluation
 * → safe normalization
 * → evidence downgrades
 *
 * May: attach StoryDNA entity IDs, rewrite real ambiguities, evaluate
 * temporal compatibility, downgrade confirmed findings that lack both-side
 * located evidence, fail passage verification, or are compatible changes.
 * Must not: invent quotations, coerce accepted canon to candidate, accept
 * Series Bible facts, approve retcons, dismiss conflicts, author-dispose,
 * silently merge ambiguous entities, or trust model-emitted entity IDs.
 */

import type { ArchivistFinding, ArchivistReview } from "./contracts.ts";
import { ARCHIVIST_CERTIFICATION_ENTITY_CATALOG } from "./entity-catalog.ts";
import {
  applyArchivistEntityResolution,
  type ArchivistEntityResolutionContext,
} from "./entity-resolution.ts";
import {
  confirmedContradictionHasBothSides,
  evidencePassesPassageVerification,
} from "./evidence.ts";
import { normalizeArchivistReview } from "./normalization.ts";
import {
  applyArchivistTemporalContinuity,
  confirmedContradictionMayStand,
} from "./temporal-continuity.ts";

export interface ArchivistLivePostprocessOptions {
  manuscriptText?: string;
  entityContext?: ArchivistEntityResolutionContext;
  useCertificationEntityCatalog?: boolean;
}

function manuscriptEvidenceVerified(
  finding: ArchivistFinding,
  manuscriptText: string | undefined,
): boolean {
  const records = [...(finding.current_evidence ?? []), ...(finding.conflicting_evidence ?? [])];
  return records.every((record) => evidencePassesPassageVerification(record, manuscriptText));
}

function isUnnecessaryCleanVerification(finding: ArchivistFinding): boolean {
  if (finding.classification !== "author_verification_needed") return false;
  if (finding.confidence === "insufficient") return false;
  if (finding.issue_type === "entity_ambiguity") return false;
  if ((finding.conflicting_evidence?.length ?? 0) > 0) return false;
  if (finding.conflicting_location?.locator?.trim()) return false;
  return true;
}

function downgradeConfirmedFinding(
  finding: ArchivistFinding,
  manuscriptText: string | undefined,
): ArchivistFinding {
  if (finding.classification !== "confirmed_contradiction") return finding;

  const bothSides = confirmedContradictionHasBothSides(finding);
  const passagesOk = manuscriptEvidenceVerified(finding, manuscriptText);
  const compatibility = finding.temporal_analysis?.continuity_compatibility;
  const compatibilityBlocks = compatibility
    ? !confirmedContradictionMayStand(compatibility)
    : finding.temporal_analysis?.relation === "unknown";

  if (bothSides && passagesOk && !compatibilityBlocks) return finding;

  const hasAnyLocated =
    (finding.current_evidence?.length ?? 0) > 0 || (finding.conflicting_evidence?.length ?? 0) > 0;

  return {
    ...finding,
    classification: hasAnyLocated ? "possible_continuity_conflict" : "author_verification_needed",
  };
}

function resolvePostprocessOptions(
  manuscriptTextOrOptions?: string | ArchivistLivePostprocessOptions,
  options?: ArchivistLivePostprocessOptions,
): ArchivistLivePostprocessOptions {
  if (typeof manuscriptTextOrOptions === "string" || manuscriptTextOrOptions === undefined) {
    return {
      ...options,
      manuscriptText: manuscriptTextOrOptions ?? options?.manuscriptText,
    };
  }
  return manuscriptTextOrOptions;
}

export function applyArchivistLivePostprocess(
  review: ArchivistReview,
  manuscriptTextOrOptions?: string | ArchivistLivePostprocessOptions,
  options?: ArchivistLivePostprocessOptions,
): ArchivistReview {
  const resolvedOptions = resolvePostprocessOptions(manuscriptTextOrOptions, options);
  const entityContext: ArchivistEntityResolutionContext = {
    catalog: resolvedOptions.entityContext?.catalog
      ?? (resolvedOptions.useCertificationEntityCatalog
        ? ARCHIVIST_CERTIFICATION_ENTITY_CATALOG
        : undefined),
    canonStore: resolvedOptions.entityContext?.canonStore,
    canonScope: resolvedOptions.entityContext?.canonScope,
  };

  const identitiesApplied = applyArchivistEntityResolution(review, entityContext);
  const temporallyEvaluated = identitiesApplied.findings.map((finding) =>
    applyArchivistTemporalContinuity(finding),
  );
  const evidenceAdjusted = temporallyEvaluated
    .map((finding) => downgradeConfirmedFinding(finding, resolvedOptions.manuscriptText))
    .filter((finding) => !isUnnecessaryCleanVerification(finding));

  return normalizeArchivistReview({
    ...identitiesApplied,
    findings: evidenceAdjusted,
    generation: {
      ...identitiesApplied.generation,
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
