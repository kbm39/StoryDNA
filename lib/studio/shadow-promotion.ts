import { randomUUID } from "node:crypto";
import { countManuscriptWords } from "@/lib/word-count.ts";
import { hashText } from "./export-location-integrity.ts";
import type { StudioShadowManuscript } from "./shadow-types.ts";
import {
  STUDIO_SHADOW_PROMOTION_LABEL_PREFIX,
  STUDIO_SHADOW_PROMOTION_VERSION,
  type StudioShadowPromotionGateResult,
  type StudioShadowPromotionRequest,
  type StudioShadowPromotionResult,
} from "./shadow-promotion-types.ts";

export function validateShadowPromotionGates(input: {
  readonly shadow: StudioShadowManuscript | { error: string };
  readonly request: StudioShadowPromotionRequest;
}): StudioShadowPromotionGateResult {
  if ("error" in input.shadow) {
    return Object.freeze({
      status: "stale",
      blockingReasons: Object.freeze([input.shadow.error]),
      readyForPromotion: false,
    });
  }

  const blockingReasons: string[] = [];

  if (!input.request.confirmation.acknowledgedNonActive) {
    blockingReasons.push("Explicit non-active promotion acknowledgement is required.");
  }
  if (!input.request.confirmation.acknowledgedCanonicalUnchanged) {
    blockingReasons.push("Explicit canonical-unchanged acknowledgement is required.");
  }

  if (input.shadow.application.unresolvedConflictCount > 0) {
    blockingReasons.push("Unresolved conflicts remain.");
  }
  if (input.shadow.application.failedRevisionCount > 0) {
    blockingReasons.push("One or more revisions failed or were blocked during application.");
  }
  if (input.shadow.application.appliedRevisionCount === 0) {
    blockingReasons.push("No revisions were applied to the shadow preview.");
  }
  if (!input.shadow.integrity.readyForPromotionReview) {
    blockingReasons.push("Shadow preview is not ready for promotion review.");
  }
  if (input.shadow.application.applicationStatus === "failed") {
    blockingReasons.push("Shadow application failed.");
  }
  if (input.shadow.application.applicationStatus === "blocked") {
    blockingReasons.push("Shadow application is blocked.");
  }

  if (input.request.expectedShadowHash !== input.shadow.application.finalHash) {
    blockingReasons.push(
      "Shadow hash mismatch. Regenerate the preview before promoting.",
    );
  }

  const status: StudioShadowPromotionGateResult["status"] =
    blockingReasons.some((r) => r.includes("hash mismatch") || r.includes("changed"))
      ? "stale"
      : blockingReasons.length > 0
        ? "blocked"
        : "ready";

  return Object.freeze({
    status,
    blockingReasons: Object.freeze(blockingReasons),
    readyForPromotion: blockingReasons.length === 0,
  });
}

export function buildPromotionVersionLabel(input: {
  readonly customLabel?: string | null;
  readonly promotedAt: string;
}): string {
  const trimmed = input.customLabel?.trim();
  if (trimmed) return trimmed;
  const date = input.promotedAt.slice(0, 10);
  return `${STUDIO_SHADOW_PROMOTION_LABEL_PREFIX} (${date})`;
}

export function buildPromotionVersionInsert(input: {
  readonly manuscriptId: string;
  readonly shadow: StudioShadowManuscript;
  readonly sourceVersionId: string | null;
  readonly sourceFilename: string | null;
  readonly sourceStoragePath: string | null;
  readonly nextVersionNumber: number;
  readonly promotionLabel?: string | null;
}): {
  readonly promotionId: string;
  readonly row: {
    readonly manuscript_id: string;
    readonly version_number: number;
    readonly label: string;
    readonly source_filename: string;
    readonly storage_path: string;
    readonly file_size: number;
    readonly extracted_text: string;
    readonly word_count: number;
    readonly character_count: number;
    readonly content_hash: string;
    readonly supersedes_version_id: string | null;
    readonly is_current: false;
    readonly notes: string;
  };
  readonly result: StudioShadowPromotionResult;
} {
  const promotionId = randomUUID();
  const promotedAt = new Date().toISOString();
  const label = buildPromotionVersionLabel({
    customLabel: input.promotionLabel,
    promotedAt,
  });
  const shadowText = input.shadow.shadowText;
  const wordCount = countManuscriptWords(shadowText);
  const characterCount = shadowText.length;
  const contentHash = hashText(shadowText);
  const date = promotedAt.slice(0, 10);
  const baseName =
    (input.sourceFilename ?? "manuscript").replace(/\.[^.]+$/, "") || "manuscript";

  const row = Object.freeze({
    manuscript_id: input.manuscriptId,
    version_number: input.nextVersionNumber,
    label,
    source_filename: `${baseName}-shadow-promoted-${date}.txt`,
    storage_path: `studio/shadow-promoted/${input.manuscriptId}/${promotionId}.txt`,
    file_size: Buffer.byteLength(shadowText, "utf8"),
    extracted_text: shadowText,
    word_count: wordCount,
    character_count: characterCount,
    content_hash: contentHash,
    supersedes_version_id: input.sourceVersionId,
    is_current: false as const,
    notes: JSON.stringify(
      Object.freeze({
        studioShadowPromotion: STUDIO_SHADOW_PROMOTION_VERSION,
        promotionId,
        shadowId: input.shadow.shadowId,
        sourceActiveVersionId: input.sourceVersionId,
        sourceShadowHash: input.shadow.application.finalHash,
        appliedRevisionIds: input.shadow.appliedItems.map((i) => i.revisionCandidateId),
        decisionSnapshotHash: input.shadow.integrity.decisionSnapshotHash,
        promotedAt,
      }),
    ),
  });

  const result: StudioShadowPromotionResult = Object.freeze({
    promotionVersion: STUDIO_SHADOW_PROMOTION_VERSION,
    promotionId,
    promotedAt,
    manuscriptVersionId: promotionId,
    versionNumber: input.nextVersionNumber,
    label,
    sourceActiveVersionId: input.sourceVersionId,
    shadowHash: contentHash,
    wordCount,
    characterCount,
    appliedRevisionCount: input.shadow.application.appliedRevisionCount,
    integrity: Object.freeze({
      canonicalManuscriptModified: false,
      currentVersionIdUnchanged: true,
      promotedVersionIsActive: false,
      sourceVersionStillActive: true,
    }),
  });

  return Object.freeze({ promotionId, row, result });
}
