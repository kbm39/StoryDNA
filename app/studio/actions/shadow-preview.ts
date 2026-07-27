"use server";

import { requireStudioAccess } from "@/lib/studio/access.ts";
import { getManuscriptMeta, getManuscriptReviewContext } from "@/lib/reviews.ts";
import { getSupabaseAdmin } from "@/lib/supabase/server.ts";
import { buildAcceptedRevisionManifest } from "@/lib/studio/revision-export-manifest.ts";
import {
  applyAcceptedRevisionsToShadow,
  assertCanonicalIntegrityUnchanged,
  defaultSelectedRevisionIds,
  snapshotCanonicalIntegrity,
} from "@/lib/studio/shadow-application-engine.ts";
import type { ShadowConflictResolution } from "@/lib/studio/shadow-types.ts";
import type { StudioShadowManuscript } from "@/lib/studio/shadow-types.ts";

export async function getShadowPreviewBootstrap(manuscriptId: string) {
  await requireStudioAccess(`/studio/books/${manuscriptId}/apply-preview`);
  const manifest = await buildAcceptedRevisionManifest({ manuscriptId });
  if (!manifest) return { ok: false as const, error: "Manuscript not found." };

  return {
    ok: true as const,
    manifest,
    defaultSelectedIds: defaultSelectedRevisionIds(manifest),
  };
}

export async function generateStudioShadowPreview(input: {
  manuscriptId: string;
  expectedActiveVersionId: string | null;
  expectedDecisionSnapshotHash: string;
  selectedRevisionIds: readonly string[];
  conflictResolutions: readonly ShadowConflictResolution[];
}): Promise<{ ok: true; shadow: StudioShadowManuscript } | { ok: false; error: string }> {
  await requireStudioAccess(`/studio/books/${input.manuscriptId}/apply-preview`);

  const meta = await getManuscriptMeta(input.manuscriptId);
  if (!meta) return { ok: false, error: "Manuscript not found." };

  const supabase = getSupabaseAdmin();
  const { data: manuscriptRow } = await supabase
    .from("manuscripts")
    .select("extracted_text, current_version_id, storage_path")
    .eq("id", input.manuscriptId)
    .maybeSingle();

  const beforeIntegrity = snapshotCanonicalIntegrity({
    extractedText: (manuscriptRow?.extracted_text as string | null) ?? null,
    currentVersionId: (manuscriptRow?.current_version_id as string | null) ?? null,
    storagePath: (manuscriptRow?.storage_path as string | null) ?? null,
  });

  const ctx = await getManuscriptReviewContext(input.manuscriptId);
  if (!ctx?.extractedText) return { ok: false, error: "Manuscript has no extracted text." };

  const manifest = await buildAcceptedRevisionManifest({ manuscriptId: input.manuscriptId });
  if (!manifest) return { ok: false, error: "Unable to build revision manifest." };

  const result = applyAcceptedRevisionsToShadow({
    manifest,
    sourceText: ctx.passageVerificationText ?? ctx.extractedText,
    selectedRevisionIds: input.selectedRevisionIds,
    conflictResolutions: input.conflictResolutions,
    expectedActiveVersionId: input.expectedActiveVersionId,
    expectedDecisionSnapshotHash: input.expectedDecisionSnapshotHash,
  });

  if ("error" in result) return { ok: false, error: result.error };

  const { data: afterRow } = await supabase
    .from("manuscripts")
    .select("extracted_text, current_version_id, storage_path")
    .eq("id", input.manuscriptId)
    .maybeSingle();

  const afterIntegrity = snapshotCanonicalIntegrity({
    extractedText: (afterRow?.extracted_text as string | null) ?? null,
    currentVersionId: (afterRow?.current_version_id as string | null) ?? null,
    storagePath: (afterRow?.storage_path as string | null) ?? null,
  });

  if (!assertCanonicalIntegrityUnchanged(beforeIntegrity, afterIntegrity)) {
    return { ok: false, error: "Canonical manuscript integrity check failed." };
  }

  return { ok: true, shadow: result };
}
