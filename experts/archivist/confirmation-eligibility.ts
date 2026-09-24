/**
 * StoryDNA-owned confirmation eligibility.
 *
 * The model's classification is advisory input. A finding may become or
 * remain a confirmed contradiction only when every deterministic gate
 * passes. Do not promote merely because two excerpts exist.
 */

import type {
  ArchivistClassification,
  ArchivistFinding,
  ArchivistReview,
} from "./contracts.ts";
import {
  confirmedContradictionHasBothSides,
  evidencePassesPassageVerification,
} from "./evidence.ts";
import { type ArchivistResolvableEntity } from "./entity-catalog.ts";
import { resolveArchivistEntityIdentity } from "./entity-resolution.ts";
import type { ArchivistEntityResolutionContext } from "./entity-resolution.ts";
import { classifyFactPersistence, persistenceAllowsUnexplainedConfirm } from "./fact-persistence.ts";
import { evaluateInjuryContinuity } from "./injury-laterality.ts";
import { evaluateObjectPossessionContinuity } from "./object-possession.ts";
import { confirmedContradictionMayStand, findingTextHints } from "./temporal-continuity.ts";

export const ARCHIVIST_CONFIRMATION_ELIGIBILITIES = [
  "eligible",
  "ineligible",
  "insufficient_evidence",
] as const;
export type ConfirmationEligibility = (typeof ARCHIVIST_CONFIRMATION_ELIGIBILITIES)[number];

export type ClassificationAdjustmentKind = "promoted" | "downgraded" | "unchanged";

export interface ConfirmationEligibilityContext {
  manuscriptText?: string;
  review?: Pick<ArchivistReview, "canon_delta" | "entity_ambiguities">;
  entityContext?: ArchivistEntityResolutionContext;
}

export interface ConfirmationEligibilityResult {
  eligibility: ConfirmationEligibility;
  model_classification: ArchivistClassification;
  final_classification: ArchivistClassification;
  adjustment: ClassificationAdjustmentKind;
  reason: string;
  failed_gates: string[];
}

const ISSUE_TYPES_REQUIRING_SUBJECT = new Set([
  "appearance",
  "injury",
  "knowledge_state",
  "relationship",
  "possession",
  "object_continuity",
  "alive_status",
  "age",
  "family_history",
  "rank_title",
]);

function manuscriptEvidenceVerified(
  finding: ArchivistFinding,
  manuscriptText: string | undefined,
): boolean {
  const records = [...(finding.current_evidence ?? []), ...(finding.conflicting_evidence ?? [])];
  return records.every((record) => evidencePassesPassageVerification(record, manuscriptText));
}

function hasApprovedRetcon(finding: ArchivistFinding): boolean {
  if (finding.conflicting_canon_status === "superseded") return true;
  if (finding.conflicting_authority === "author_approved_exception") return true;
  if (finding.conflicting_source === "author_approved_exception") return true;
  const records = [...(finding.current_evidence ?? []), ...(finding.conflicting_evidence ?? [])];
  return records.some((record) => record.source_kind === "author_approved_exception");
}

function extractCandidateAliases(finding: ArchivistFinding, catalog: readonly ArchivistResolvableEntity[]): string[] {
  const haystack = findingTextHints(finding);
  const aliases: string[] = [];
  for (const entity of catalog) {
    for (const alias of [entity.canonical_name, ...entity.aliases]) {
      if (!alias.trim()) continue;
      const pattern = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (pattern.test(haystack)) aliases.push(alias);
    }
  }
  const unique = [...new Set(aliases)].sort((a, b) => b.length - a.length);
  return unique.filter((alias, index) =>
    !unique.some((other, otherIndex) => otherIndex < index && other.toLowerCase().includes(alias.toLowerCase())),
  );
}

function entityIdentityGate(
  finding: ArchivistFinding,
  context: ConfirmationEligibilityContext | undefined,
): string | null {
  if (finding.issue_type === "entity_ambiguity") {
    return "ambiguous_or_unresolved_entity";
  }
  const ambiguities = context?.review?.entity_ambiguities ?? [];
  if (ambiguities.some((item) => item.candidate_entities.length >= 2)) {
    const haystack = findingTextHints(finding).toLowerCase();
    const mentioned = ambiguities.some((item) => haystack.includes(item.alias.toLowerCase()));
    if (mentioned) {
      return "ambiguous_or_unresolved_entity";
    }
  }

  const catalog = context?.entityContext?.catalog;
  const deltas = context?.review?.canon_delta ?? [];
  const resolvedDelta = deltas.some(
    (delta) => delta.entity.resolution === "resolved" && Boolean(delta.entity.entity_id),
  );
  const ambiguousDelta = deltas.some((delta) => delta.entity.resolution === "ambiguous");
  if (ambiguousDelta) return "ambiguous_or_unresolved_entity";
  if (resolvedDelta) return null;

  if (catalog && catalog.length > 0) {
    const aliases = extractCandidateAliases(finding, catalog);
    const resolutions = aliases.map((alias) =>
      resolveArchivistEntityIdentity(alias, "person", context?.entityContext),
    );
    if (resolutions.some((item) => item.status === "ambiguous")) {
      return "ambiguous_or_unresolved_entity";
    }
    if (resolutions.some((item) => item.status === "resolved")) return null;
    if (ISSUE_TYPES_REQUIRING_SUBJECT.has(finding.issue_type) && aliases.length === 0) {
      return "unresolved_entity";
    }
    if (ISSUE_TYPES_REQUIRING_SUBJECT.has(finding.issue_type) && !resolutions.some((item) => item.status === "resolved")) {
      return "unresolved_entity";
    }
  }

  return null;
}

function failedConfirmationGates(
  finding: ArchivistFinding,
  context: ConfirmationEligibilityContext | undefined,
): string[] {
  const failed: string[] = [];
  const entityFail = entityIdentityGate(finding, context);
  if (entityFail) failed.push(entityFail);

  const currentOk = (finding.current_evidence?.length ?? 0) > 0;
  const conflictingOk = (finding.conflicting_evidence?.length ?? 0) > 0;
  if (!currentOk) failed.push("missing_current_evidence");
  if (!conflictingOk) failed.push("missing_conflicting_evidence");
  if (!finding.current_location?.locator?.trim() || !finding.conflicting_location?.locator?.trim()) {
    failed.push("missing_locators");
  }
  if (!confirmedContradictionHasBothSides(finding)) failed.push("both_sides_not_verified");
  if (!manuscriptEvidenceVerified(finding, context?.manuscriptText)) {
    failed.push("passage_verification_failed");
  }

  const relation = finding.temporal_analysis?.relation;
  if (!relation || relation === "unknown") failed.push("temporal_relation_unknown");

  const compatibility = finding.temporal_analysis?.continuity_compatibility;
  if (!compatibility || !confirmedContradictionMayStand(compatibility)) {
    failed.push("compatibility_not_confirmable");
  }

  if (hasApprovedRetcon(finding)) failed.push("approved_retcon_or_superseded_canon");

  const persistence = classifyFactPersistence({
    factType: finding.issue_type,
    issueType: finding.issue_type,
    textHints: findingTextHints(finding),
  });
  if (!persistenceAllowsUnexplainedConfirm(persistence)) {
    if (persistence === "unknown") failed.push("persistence_unknown");
    if (persistence === "ephemeral" && compatibility !== "incompatible") {
      failed.push("ephemeral_without_incompatibility");
    }
  }

  const injury = evaluateInjuryContinuity(finding);
  if (injury.applies && injury.same_injury === false) {
    failed.push("separate_injury_explanation");
  }

  const object = evaluateObjectPossessionContinuity(finding);
  if (object.applies && !object.unique) {
    failed.push("non_unique_object");
  }

  if (finding.confidence === "insufficient") failed.push("confidence_insufficient");
  return failed;
}

function eligibilityFromFailures(failed: string[]): ConfirmationEligibility {
  if (failed.length === 0) return "eligible";
  const insufficient = failed.every((gate) =>
    [
      "missing_current_evidence",
      "missing_conflicting_evidence",
      "missing_locators",
      "both_sides_not_verified",
      "passage_verification_failed",
      "temporal_relation_unknown",
      "confidence_insufficient",
      "unresolved_entity",
      "persistence_unknown",
    ].includes(gate),
  );
  return insufficient ? "insufficient_evidence" : "ineligible";
}

function fallbackClassification(
  finding: ArchivistFinding,
  eligibility: ConfirmationEligibility,
): ArchivistClassification {
  if (eligibility === "insufficient_evidence") return "author_verification_needed";
  const hasAnyLocated =
    (finding.current_evidence?.length ?? 0) > 0 || (finding.conflicting_evidence?.length ?? 0) > 0;
  return hasAnyLocated ? "possible_continuity_conflict" : "author_verification_needed";
}

function adjustmentReason(
  model: ArchivistClassification,
  final: ArchivistClassification,
  eligibility: ConfirmationEligibility,
  failed: string[],
): string {
  if (model === final) {
    return eligibility === "eligible"
      ? "Model classification already matches deterministic confirmation eligibility."
      : `StoryDNA left the model classification unchanged (${failed.join(", ") || eligibility}).`;
  }
  if (final === "confirmed_contradiction") {
    return "Both passages are verified, entity identity is resolved, no transition or retcon explains the change, and continuity compatibility is incompatible or unexplained.";
  }
  if (failed.includes("approved_retcon_or_superseded_canon")) {
    return "Cannot confirm a contradiction against superseded canon or an author-approved exception.";
  }
  if (failed.includes("compatibility_not_confirmable")) {
    return "Continuity compatibility is a compatible change or insufficient evidence, so confirmation cannot stand.";
  }
  if (failed.includes("ambiguous_or_unresolved_entity")) {
    return "Entity identity is ambiguous or unresolved; confirmation is withheld.";
  }
  if (failed.includes("both_sides_not_verified") || failed.includes("missing_conflicting_evidence")) {
    return "Confirmed contradiction requires both-side located evidence and locators.";
  }
  return `Deterministic confirmation gates failed: ${failed.join(", ")}.`;
}

export function evaluateConfirmationEligibility(
  finding: ArchivistFinding,
  context?: ConfirmationEligibilityContext,
): ConfirmationEligibilityResult {
  const model_classification = finding.model_classification ?? finding.classification;
  const failed = failedConfirmationGates(finding, context);
  const eligibility = eligibilityFromFailures(failed);

  let final_classification: ArchivistClassification = model_classification;
  if (eligibility === "eligible") {
    if (
      model_classification === "possible_continuity_conflict" ||
      model_classification === "author_verification_needed" ||
      model_classification === "confirmed_contradiction"
    ) {
      final_classification = "confirmed_contradiction";
    }
  } else if (model_classification === "confirmed_contradiction") {
    final_classification = fallbackClassification(finding, eligibility);
  }

  const adjustment: ClassificationAdjustmentKind =
    final_classification === model_classification
      ? "unchanged"
      : final_classification === "confirmed_contradiction"
        ? "promoted"
        : "downgraded";

  return {
    eligibility,
    model_classification,
    final_classification,
    adjustment,
    reason: adjustmentReason(model_classification, final_classification, eligibility, failed),
    failed_gates: failed,
  };
}

export function applyConfirmationEligibility(
  finding: ArchivistFinding,
  context?: ConfirmationEligibilityContext,
): ArchivistFinding {
  const evaluated = evaluateConfirmationEligibility(
    {
      ...finding,
      model_classification: finding.model_classification ?? finding.classification,
    },
    context,
  );
  return {
    ...finding,
    model_classification: evaluated.model_classification,
    classification: evaluated.final_classification,
    final_classification: evaluated.final_classification,
    confirmation_eligibility: evaluated.eligibility,
    classification_adjustment_reason: evaluated.reason,
  };
}

export function summarizeClassificationAdjustments(findings: readonly ArchivistFinding[]): {
  model_confirmed_count: number;
  final_confirmed_count: number;
  deterministic_promotions: number;
  deterministic_downgrades: number;
  unchanged_findings: number;
} {
  let promotions = 0;
  let downgrades = 0;
  let unchanged = 0;
  let modelConfirmed = 0;
  let finalConfirmed = 0;
  for (const finding of findings) {
    const model = finding.model_classification ?? finding.classification;
    const final = finding.final_classification ?? finding.classification;
    if (model === "confirmed_contradiction") modelConfirmed += 1;
    if (final === "confirmed_contradiction") finalConfirmed += 1;
    if (model === final) unchanged += 1;
    else if (final === "confirmed_contradiction") promotions += 1;
    else downgrades += 1;
  }
  return {
    model_confirmed_count: modelConfirmed,
    final_confirmed_count: finalConfirmed,
    deterministic_promotions: promotions,
    deterministic_downgrades: downgrades,
    unchanged_findings: unchanged,
  };
}
