/**
 * Deterministic canon-delta sanitization.
 *
 * Findings and canon_delta are separate outputs. A malformed optional
 * candidate must not erase an independently valid continuity finding.
 * Incomplete candidates are dropped with audit. Unsafe authoritative
 * mutation attempts remain fail-closed and are never coerced to candidate.
 * StoryDNA owns proposed authority; the model cannot elevate it.
 */

import {
  isModelProposableAuthority,
  type ArchivistCanonDelta,
  type ArchivistCanonDeltaDisposition,
  type ArchivistCanonDeltaDispositionSummary,
  type ArchivistModelProposableAuthority,
  type ArchivistReview,
  type CanonAuthority,
} from "./contracts.ts";

export const ARCHIVIST_CANON_DELTA_SANITIZATION_VERSION =
  "archivist_canon_delta_sanitization@v1" as const;

const PRIOR_SOURCE_KINDS = new Set(["prior_volume_canon", "series_bible"]);
const UNSAFE_MODEL_AUTHORITIES = new Set<CanonAuthority>([
  "series_bible_accepted",
  "author_approved_exception",
]);
const PRIOR_LOCATOR = /\bbook\s*1\b|\bprior\s+volume\b|\bseries[_\s-]?bible\b/i;

export function proposedFactValueIsEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value !== "object" || Array.isArray(value)) return true;
  return Object.keys(value as Record<string, unknown>).length === 0;
}

export function summarizeCanonDeltaDispositions(
  dispositions: readonly ArchivistCanonDeltaDisposition[],
): ArchivistCanonDeltaDispositionSummary {
  return {
    emitted: dispositions.length,
    retained: dispositions.filter((item) => item.disposition === "retained").length,
    dropped_incomplete: dispositions.filter((item) => item.disposition === "dropped_incomplete")
      .length,
    dropped_reference_only: dispositions.filter(
      (item) => item.disposition === "dropped_reference_only",
    ).length,
    rejected_unsafe: dispositions.filter((item) => item.disposition === "rejected_unsafe").length,
  };
}

export function reviewHasRejectedUnsafeCanonDelta(review: ArchivistReview): boolean {
  return (review.canon_delta_dispositions ?? []).some(
    (item) => item.disposition === "rejected_unsafe",
  );
}

function modelProposedAuthority(delta: ArchivistCanonDelta): string {
  return String(delta.proposed_authority ?? "");
}

function hasPriorSourceEvidence(delta: ArchivistCanonDelta): boolean {
  return (delta.evidence ?? []).some((record) => PRIOR_SOURCE_KINDS.has(record.source_kind));
}

function locatorLooksPrior(delta: ArchivistCanonDelta): boolean {
  return PRIOR_LOCATOR.test(delta.source_location?.locator ?? "");
}

function isPriorCanonReference(delta: ArchivistCanonDelta): boolean {
  if (hasPriorSourceEvidence(delta)) return true;
  if (delta.proposed_authority === "prior_volume_canon" && locatorLooksPrior(delta)) return true;
  return false;
}

function unsafeReason(delta: ArchivistCanonDelta): string | null {
  if ((delta.status as string) === "accepted") return "status_accepted";
  if ((delta.status as string) !== "candidate") return "status_not_candidate";
  if (delta.proposed_authority === "series_bible_accepted") {
    return "model_proposed_series_bible_accepted";
  }
  if (delta.proposed_authority === "author_approved_exception") {
    return "model_proposed_author_approved_exception";
  }
  if (UNSAFE_MODEL_AUTHORITIES.has(delta.proposed_authority)) {
    return "model_proposed_authoritative_authority";
  }
  return null;
}

export function assignSafeCandidateAuthority(
  delta: ArchivistCanonDelta,
): ArchivistModelProposableAuthority {
  if (delta.inferred === true || delta.proposed_authority === "inferred") return "inferred";
  if (
    delta.proposed_authority === "uncertain_observation" ||
    delta.confidence === "insufficient"
  ) {
    return "uncertain_observation";
  }
  return "current_observation";
}

function incompleteReason(delta: ArchivistCanonDelta): string | null {
  if (proposedFactValueIsEmpty(delta.proposed_fact_value)) return "missing_proposed_fact_value";
  return null;
}

function sanitizeOne(
  delta: ArchivistCanonDelta,
  originalIndex: number,
): { retained: ArchivistCanonDelta | null; audit: ArchivistCanonDeltaDisposition } {
  const modelAuthority = modelProposedAuthority(delta);
  const base = {
    original_index: originalIndex,
    delta_id: delta.id?.trim() || `canon-delta-${originalIndex + 1}`,
    model_proposed_authority: modelAuthority || undefined,
  };

  const unsafe = unsafeReason(delta);
  if (unsafe) {
    return {
      retained: null,
      audit: {
        ...base,
        disposition: "rejected_unsafe",
        reason: unsafe,
      },
    };
  }

  const incomplete = incompleteReason(delta);
  if (incomplete) {
    return {
      retained: null,
      audit: {
        ...base,
        disposition: "dropped_incomplete",
        reason: incomplete,
      },
    };
  }

  if (isPriorCanonReference(delta)) {
    return {
      retained: null,
      audit: {
        ...base,
        disposition: "dropped_reference_only",
        reason: "prior_canon_reference_only",
      },
    };
  }

  const assigned = isModelProposableAuthority(delta.proposed_authority)
    ? delta.proposed_authority
    : assignSafeCandidateAuthority(delta);

  return {
    retained: {
      ...delta,
      proposed_authority: assigned,
      inferred: assigned === "inferred" || delta.inferred === true,
    },
    audit: {
      ...base,
      disposition: "retained",
      reason:
        assigned === delta.proposed_authority
          ? "valid_candidate"
          : "authority_reassigned_from_model",
      assigned_authority: assigned,
    },
  };
}

export function applyArchivistCanonDeltaSanitization(review: ArchivistReview): ArchivistReview {
  const retained: ArchivistCanonDelta[] = [];
  const dispositions: ArchivistCanonDeltaDisposition[] = [];

  for (const [index, delta] of review.canon_delta.entries()) {
    const result = sanitizeOne(delta, index);
    dispositions.push(result.audit);
    if (result.retained) retained.push(result.retained);
  }

  return {
    ...review,
    canon_delta: retained,
    canon_delta_dispositions: dispositions,
  };
}

export function unsafeCanonDeltaValidationErrors(review: ArchivistReview): string[] {
  const errors: string[] = [];
  for (const item of review.canon_delta_dispositions ?? []) {
    if (item.disposition !== "rejected_unsafe") continue;
    const prefix = `canon_delta[${item.original_index}]`;
    if (item.reason === "status_accepted" || item.reason === "status_not_candidate") {
      errors.push(`${prefix}: canon_delta status must be candidate; accepted facts cannot be emitted`);
      continue;
    }
    const authority =
      item.reason === "model_proposed_series_bible_accepted"
        ? "series_bible_accepted"
        : item.reason === "model_proposed_author_approved_exception"
          ? "author_approved_exception"
          : item.model_proposed_authority;
    if (authority) {
      errors.push(`${prefix}: model output may not propose authority "${authority}"`);
      continue;
    }
    errors.push(`${prefix}: rejected unsafe canon candidate (${item.reason})`);
  }
  return errors;
}
