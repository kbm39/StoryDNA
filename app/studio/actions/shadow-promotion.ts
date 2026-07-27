"use server";

import { requireStudioAccess } from "@/lib/studio/access.ts";
import { getManuscriptReviewContext } from "@/lib/reviews.ts";
import { getSupabaseAdmin } from "@/lib/supabase/server.ts";
import { buildAcceptedRevisionManifest } from "@/lib/studio/revision-export-manifest.ts";
import {
  applyAcceptedRevisionsToShadow,
  assertCanonicalIntegrityUnchanged,
  snapshotCanonicalIntegrity,
} from "@/lib/studio/shadow-application-engine.ts";
import {
  buildPromotionVersionInsert,
  validateShadowPromotionGates,
} from "@/lib/studio/shadow-promotion.ts";
import type {
  StudioShadowPromotionRequest,
  StudioShadowPromotionResult,
} from "@/lib/studio/shadow-promotion-types.ts";

export async function promoteStudioShadowManuscript(
  request: StudioShadowPromotionRequest,
): Promise<
  | { ok: true; promotion: StudioShadowPromotionResult; manuscriptVersionId: string }
  | { ok: false; error: string; blockingReasons?: readonly string[] }
> {
  await requireStudioAccess(`/studio/books/${request.manuscriptId}/apply-preview`);

  const supabase = getSupabaseAdmin();

  const { data: manuscriptRow, error: manuscriptError } = await supabase
    .from("manuscripts")
    .select("extracted_text, current_version_id, storage_path, original_filename")
    .eq("id", request.manuscriptId)
    .maybeSingle();

  if (manuscriptError || !manuscriptRow) {
    return { ok: false, error: "Manuscript not found." };
  }

  const beforeIntegrity = snapshotCanonicalIntegrity({
    extractedText: (manuscriptRow.extracted_text as string | null) ?? null,
    currentVersionId: (manuscriptRow.current_version_id as string | null) ?? null,
    storagePath: (manuscriptRow.storage_path as string | null) ?? null,
  });

  const ctx = await getManuscriptReviewContext(request.manuscriptId);
  if (!ctx?.extractedText) {
    return { ok: false, error: "Manuscript has no extracted text." };
  }

  const manifest = await buildAcceptedRevisionManifest({ manuscriptId: request.manuscriptId });
  if (!manifest) {
    return { ok: false, error: "Unable to build revision manifest." };
  }

  const shadow = applyAcceptedRevisionsToShadow({
    manifest,
    sourceText: ctx.passageVerificationText ?? ctx.extractedText,
    selectedRevisionIds: request.selectedRevisionIds,
    conflictResolutions: request.conflictResolutions,
    expectedActiveVersionId: request.expectedActiveVersionId,
    expectedDecisionSnapshotHash: request.expectedDecisionSnapshotHash,
  });

  const gates = validateShadowPromotionGates({ shadow, request });
  if (!gates.readyForPromotion) {
    return {
      ok: false,
      error: gates.blockingReasons[0] ?? "Shadow promotion is blocked.",
      blockingReasons: gates.blockingReasons,
    };
  }

  if ("error" in shadow) {
    return { ok: false, error: shadow.error };
  }

  const { data: versionRows } = await supabase
    .from("manuscript_versions")
    .select("version_number")
    .eq("manuscript_id", request.manuscriptId)
    .order("version_number", { ascending: false })
    .limit(1);

  const nextVersionNumber = ((versionRows?.[0]?.version_number as number | undefined) ?? 0) + 1;

  const { row, result } = buildPromotionVersionInsert({
    manuscriptId: request.manuscriptId,
    shadow,
    sourceVersionId: (manuscriptRow.current_version_id as string | null) ?? null,
    sourceFilename: (manuscriptRow.original_filename as string | null) ?? null,
    sourceStoragePath: (manuscriptRow.storage_path as string | null) ?? null,
    nextVersionNumber,
    promotionLabel: request.confirmation.promotionLabel,
  });

  const { data: inserted, error: insertError } = await supabase
    .from("manuscript_versions")
    .insert({ ...row, id: result.promotionId })
    .select("id, is_current, version_number")
    .single();

  if (insertError || !inserted) {
    return { ok: false, error: insertError?.message ?? "Failed to create promoted version." };
  }

  if (inserted.is_current === true) {
    await supabase.from("manuscript_versions").delete().eq("id", inserted.id as string);
    return { ok: false, error: "Promotion incorrectly marked version as current." };
  }

  const { data: afterRow } = await supabase
    .from("manuscripts")
    .select("extracted_text, current_version_id, storage_path")
    .eq("id", request.manuscriptId)
    .maybeSingle();

  const afterIntegrity = snapshotCanonicalIntegrity({
    extractedText: (afterRow?.extracted_text as string | null) ?? null,
    currentVersionId: (afterRow?.current_version_id as string | null) ?? null,
    storagePath: (afterRow?.storage_path as string | null) ?? null,
  });

  if (!assertCanonicalIntegrityUnchanged(beforeIntegrity, afterIntegrity)) {
    return { ok: false, error: "Canonical manuscript integrity check failed after promotion." };
  }

  if (afterRow?.current_version_id !== manuscriptRow.current_version_id) {
    return { ok: false, error: "current_version_id changed during promotion." };
  }

  return {
    ok: true,
    promotion: Object.freeze({
      ...result,
      manuscriptVersionId: inserted.id as string,
    }),
    manuscriptVersionId: inserted.id as string,
  };
}
