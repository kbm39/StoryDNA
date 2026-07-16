/**
 * Review provenance, staleness classification, and editorial history — no DB writes.
 */
import { memoContentForDisplay } from "./review-display.ts";
import type { Review } from "./types.ts";
import { validateWordCountClaims } from "./word-count-validation.ts";

export function resolveCanonicalWordCount(
  review: Review,
  fallbackWordCount?: number | null,
): number {
  const fromReview = review.canonical_word_count;
  if (typeof fromReview === "number" && fromReview > 0) return fromReview;
  if (typeof fallbackWordCount === "number" && fallbackWordCount > 0) return fallbackWordCount;
  return 0;
}

/** Detect unsupported 130k / 150k / 180k / 200k current-length language. */
export function hasFalseCurrentLengthThousandsLanguage(
  text: string,
  canonicalWordCount: number,
): boolean {
  if (canonicalWordCount <= 0) return false;
  const body = memoContentForDisplay(text);
  for (const k of [130, 150, 180, 200]) {
    const kPattern = new RegExp(
      `\\b(?:about|approximately|roughly|over|around|~|well\\s+past|reads?\\s+well\\s+past)?\\s*${k}\\s*k(?:\\s*-?\\s*ish)?\\b`,
      "gi",
    );
    if (kPattern.test(body)) return true;
    const formatted = new RegExp(`\\b${k},?000\\s+words\\b`, "gi");
    if (formatted.test(body) && Math.abs(k * 1000 - canonicalWordCount) > 1000) {
      return true;
    }
  }
  return false;
}

export const SUPERSEDED_REVIEW_DISCLAIMER =
  "This assessment was generated for an earlier manuscript version and may contain outdated conclusions.";

export const PRE_ENFORCEMENT_REVIEW_LABEL =
  "Pre-enforcement — generated before canonical word-count validation.";

export const CONTRADICTS_CANONICAL_LABEL = "Contradicts canonical statistics";

export interface ReviewStalenessClassification {
  is_historical: boolean;
  pre_enforcement: boolean;
  version_mismatch: boolean;
  contradicts_canonical_statistics: boolean;
}

export interface ReviewProvenance {
  review_id: string;
  generated_at: string;
  generated_at_iso: string;
  manuscript_version_id: string | null;
  manuscript_version_label: string;
  canonical_word_count: number;
  model: string;
  lifecycle_status: "active" | "superseded";
  lifecycle_label: "Active" | "Superseded";
  staleness: ReviewStalenessClassification;
  status_labels: string[];
  warnings: string[];
  is_authoritative_active: boolean;
  historical_disclaimer: string | null;
}

export interface EditorialHistoryEntry {
  review_id: string;
  generated_at: string;
  generated_at_iso: string;
  lifecycle_status: "active" | "superseded";
  lifecycle_label: "Active" | "Superseded";
  manuscript_version_id: string | null;
  manuscript_version_label: string;
  canonical_word_count: number | null;
  model: string;
  is_authoritative_active: boolean;
  staleness: ReviewStalenessClassification;
  status_labels: string[];
  warnings: string[];
  view_href: string;
}

export function formatManuscriptVersionLabel(
  versionId: string | null | undefined,
  currentVersionId?: string | null,
): string {
  if (!versionId) return "Unknown version";
  const short = versionId.slice(0, 8);
  if (currentVersionId && versionId === currentVersionId) {
    return `${short}… (current)`;
  }
  return `${short}…`;
}

export function formatReviewGeneratedDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function classifyReviewStaleness(args: {
  review: Review;
  currentVersionId?: string | null;
  fallbackWordCount?: number | null;
  isHistoricalView?: boolean;
}): ReviewStalenessClassification {
  const lifecycle = args.review.lifecycle_status ?? "active";
  const isHistorical = args.isHistoricalView ?? lifecycle === "superseded";
  const canonicalWordCount = resolveCanonicalWordCount(args.review, args.fallbackWordCount);
  const memo = memoContentForDisplay(args.review.content);

  const versionMismatch =
    Boolean(args.currentVersionId) &&
    Boolean(args.review.manuscript_version_id) &&
    args.review.manuscript_version_id !== args.currentVersionId;

  const preEnforcement =
    args.review.canonical_word_count == null ||
    args.review.scoring_gate_valid !== true;

  let contradictsCanonical = false;
  if (canonicalWordCount > 0) {
    const wordVal = validateWordCountClaims(memo, canonicalWordCount);
    contradictsCanonical =
      !wordVal.valid ||
      hasFalseCurrentLengthThousandsLanguage(memo, canonicalWordCount);
  }

  return {
    is_historical: isHistorical,
    pre_enforcement: preEnforcement,
    version_mismatch: versionMismatch,
    contradicts_canonical_statistics: contradictsCanonical,
  };
}

export function buildReviewStatusLabels(staleness: ReviewStalenessClassification): string[] {
  const labels: string[] = [];
  if (staleness.is_historical) labels.push("Superseded");
  else labels.push("Active");
  if (staleness.pre_enforcement) labels.push("Pre-enforcement");
  if (staleness.contradicts_canonical_statistics) labels.push("Contradicts canonical statistics");
  if (staleness.version_mismatch && !staleness.is_historical) {
    labels.push("Version mismatch");
  }
  return labels;
}

export function buildReviewWarnings(staleness: ReviewStalenessClassification): string[] {
  const warnings: string[] = [];
  if (staleness.is_historical) {
    warnings.push(SUPERSEDED_REVIEW_DISCLAIMER);
  }
  if (staleness.pre_enforcement) {
    warnings.push(PRE_ENFORCEMENT_REVIEW_LABEL);
  }
  if (staleness.contradicts_canonical_statistics) {
    warnings.push(CONTRADICTS_CANONICAL_LABEL);
  }
  if (staleness.version_mismatch && !staleness.is_historical) {
    warnings.push("This active review was generated for a different manuscript version.");
  }
  return warnings;
}

export function buildReviewProvenance(args: {
  review: Review;
  currentVersionId?: string | null;
  fallbackWordCount?: number | null;
  isHistoricalView?: boolean;
  authoritativeReviewId?: string | null;
}): ReviewProvenance {
  const lifecycle = args.review.lifecycle_status ?? "active";
  const staleness = classifyReviewStaleness(args);
  const statusLabels = buildReviewStatusLabels(staleness);
  const warnings = buildReviewWarnings(staleness);
  const isAuthoritativeActive =
    lifecycle === "active" &&
    !staleness.is_historical &&
    args.authoritativeReviewId != null &&
    args.review.id === args.authoritativeReviewId;

  return {
    review_id: args.review.id,
    generated_at: formatReviewGeneratedDateTime(args.review.created_at),
    generated_at_iso: args.review.created_at,
    manuscript_version_id: args.review.manuscript_version_id ?? null,
    manuscript_version_label: formatManuscriptVersionLabel(
      args.review.manuscript_version_id,
      args.currentVersionId,
    ),
    canonical_word_count: resolveCanonicalWordCount(args.review, args.fallbackWordCount),
    model: args.review.model ?? "Unknown model",
    lifecycle_status: lifecycle,
    lifecycle_label: lifecycle === "superseded" ? "Superseded" : "Active",
    staleness,
    status_labels: statusLabels,
    warnings,
    is_authoritative_active: isAuthoritativeActive,
    historical_disclaimer: staleness.is_historical ? SUPERSEDED_REVIEW_DISCLAIMER : null,
  };
}

export function listCommercialReviewHistory(args: {
  manuscriptId: string;
  reviews: Review[];
  currentVersionId?: string | null;
  fallbackWordCount?: number | null;
  authoritativeReviewId?: string | null;
  manuscriptPagePath: string;
}): EditorialHistoryEntry[] {
  const commercial = args.reviews.filter(
    (r) => r.manuscript_id === args.manuscriptId && r.perspective === "commercial",
  );

  return commercial
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((review) => {
      const lifecycle = review.lifecycle_status ?? "active";
      const isAuthoritativeActive =
        args.authoritativeReviewId != null && review.id === args.authoritativeReviewId;
      const staleness = classifyReviewStaleness({
        review,
        currentVersionId: args.currentVersionId,
        fallbackWordCount: args.fallbackWordCount,
        isHistoricalView: lifecycle === "superseded",
      });
      const canonical =
        review.canonical_word_count ??
        (args.fallbackWordCount && args.fallbackWordCount > 0 ? args.fallbackWordCount : null);

      return {
        review_id: review.id,
        generated_at: formatReviewGeneratedDateTime(review.created_at),
        generated_at_iso: review.created_at,
        lifecycle_status: lifecycle,
        lifecycle_label: lifecycle === "superseded" ? "Superseded" : "Active",
        manuscript_version_id: review.manuscript_version_id ?? null,
        manuscript_version_label: formatManuscriptVersionLabel(
          review.manuscript_version_id,
          args.currentVersionId,
        ),
        canonical_word_count: canonical,
        model: review.model ?? "Unknown model",
        is_authoritative_active: isAuthoritativeActive,
        staleness,
        status_labels: buildReviewStatusLabels(staleness),
        warnings: buildReviewWarnings(staleness),
        view_href: isAuthoritativeActive
          ? args.manuscriptPagePath
          : `${args.manuscriptPagePath}?review=${review.id}`,
      };
    });
}

/** Provenance lines shared by UI helpers and DOCX text export. */
export function provenanceLinesForDisplay(provenance: ReviewProvenance): string[] {
  const lines = [
    `Generated: ${provenance.generated_at}`,
    `Manuscript version: ${provenance.manuscript_version_label}`,
    `Verified canonical word count: ${provenance.canonical_word_count.toLocaleString()}`,
    `AI model: ${provenance.model}`,
    `Lifecycle status: ${provenance.lifecycle_label}`,
    `Review ID: ${provenance.review_id}`,
  ];
  if (provenance.historical_disclaimer) {
    lines.push(provenance.historical_disclaimer);
  }
  for (const warning of provenance.warnings) {
    if (warning !== provenance.historical_disclaimer) {
      lines.push(warning);
    }
  }
  return lines;
}
