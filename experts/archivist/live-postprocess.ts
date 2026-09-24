/**
 * Live Archivist post-processing — constitution enforcement, not creative repair.
 *
 * Order:
 * raw payload already parsed/enveloped
 * → deterministic entity resolution
 * → prior-canon provenance attachment
 * → temporal/persistence evaluation
 * → confirmation eligibility / final classification
 * → canon-delta sanitization / disposition
 * → safe normalization
 *
 * May: attach StoryDNA entity IDs, rewrite real ambiguities, evaluate
 * temporal compatibility, and promote or downgrade classification from
 * deterministic confirmation eligibility. Never silently.
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
import { applyArchivistCanonDeltaSanitization } from "./canon-delta-sanitization.ts";
import { normalizeArchivistReview } from "./normalization.ts";
import { applyConfirmationEligibility } from "./confirmation-eligibility.ts";
import { ARCHIVIST_CERTIFICATION_PRIOR_SOURCES } from "./prior-source-catalog.ts";
import { applyPriorCanonProvenance } from "./prior-canon-provenance.ts";
import { applyArchivistTemporalContinuity } from "./temporal-continuity.ts";

export interface ArchivistLivePostprocessOptions {
  manuscriptText?: string;
  entityContext?: ArchivistEntityResolutionContext;
  useCertificationEntityCatalog?: boolean;
}

function isUnnecessaryCleanVerification(finding: ArchivistFinding): boolean {
  if (finding.classification !== "author_verification_needed") return false;
  if (finding.confidence === "insufficient") return false;
  if (finding.issue_type === "entity_ambiguity") return false;
  if ((finding.conflicting_evidence?.length ?? 0) > 0) return false;
  if (finding.conflicting_location?.locator?.trim()) return false;
  return true;
}

function applyFinalClassification(
  finding: ArchivistFinding,
  options: ArchivistLivePostprocessOptions,
  review: ArchivistReview,
): ArchivistFinding {
  return applyConfirmationEligibility(finding, {
    manuscriptText: options.manuscriptText,
    review,
    entityContext: options.entityContext,
  });
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
  const withProvenance = applyPriorCanonProvenance(identitiesApplied, {
    canonStore: entityContext.canonStore,
    priorSources: resolvedOptions.useCertificationEntityCatalog
      ? ARCHIVIST_CERTIFICATION_PRIOR_SOURCES
      : undefined,
    currentManuscriptId: identitiesApplied.manuscript_id,
    currentVersionId: identitiesApplied.manuscript_version_id,
  });
  const optionsWithContext: ArchivistLivePostprocessOptions = {
    ...resolvedOptions,
    entityContext,
  };
  const temporallyEvaluated = withProvenance.findings.map((finding) =>
    applyArchivistTemporalContinuity(finding),
  );
  const classified = temporallyEvaluated
    .map((finding) => applyFinalClassification(finding, optionsWithContext, withProvenance))
    .filter((finding) => !isUnnecessaryCleanVerification(finding));

  const sanitized = applyArchivistCanonDeltaSanitization({
    ...withProvenance,
    findings: classified,
  });

  return normalizeArchivistReview({
    ...sanitized,
    generation: {
      ...identitiesApplied.generation,
      provider: "none",
      model: "none",
    },
  });
}

export function liveReviewEmitsAcceptedCanon(review: ArchivistReview): boolean {
  if (review.canon_delta.some((delta) => (delta.status as string) !== "candidate")) {
    return true;
  }
  return (review.canon_delta_dispositions ?? []).some(
    (item) =>
      item.disposition === "rejected_unsafe" &&
      (item.reason === "status_accepted" || item.reason === "status_not_candidate"),
  );
}

export function liveReviewEmitsAuthorDisposition(review: ArchivistReview): boolean {
  return review.findings.some((finding) => finding.author_action !== "pending");
}
