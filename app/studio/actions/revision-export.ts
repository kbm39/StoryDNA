"use server";

import { requireStudioAccess } from "@/lib/studio/access.ts";
import {
  assertActiveVersionMatches,
  buildAcceptedRevisionManifest,
} from "@/lib/studio/revision-export-manifest.ts";
import { generateStudioRevisionJsonExport } from "@/lib/studio/revision-export-json.ts";
import { generateStudioRevisionMarkdownExport } from "@/lib/studio/revision-export-markdown.ts";
import type { StudioRevisionExport } from "@/lib/studio/export-types.ts";

export async function getStudioRevisionExportPreview(input: {
  manuscriptId: string;
  includeDeferred?: boolean;
}): Promise<{ ok: true; manifest: StudioRevisionExport } | { ok: false; error: string }> {
  await requireStudioAccess(`/studio/books/${input.manuscriptId}/exports`);
  const manifest = await buildAcceptedRevisionManifest({
    manuscriptId: input.manuscriptId,
    includeDeferred: input.includeDeferred === true,
  });
  if (!manifest) return { ok: false, error: "Manuscript not found." };
  return { ok: true, manifest };
}

export async function buildStudioRevisionExportForDownload(input: {
  manuscriptId: string;
  expectedActiveVersionId: string | null;
  includeDeferred?: boolean;
  format: "json" | "markdown";
}): Promise<
  | { ok: true; body: string; contentType: string }
  | { ok: false; error: string; status: number }
> {
  await requireStudioAccess(`/studio/books/${input.manuscriptId}/exports`);

  const versionCheck = await assertActiveVersionMatches({
    manuscriptId: input.manuscriptId,
    expectedActiveVersionId: input.expectedActiveVersionId,
  });
  if (!versionCheck.ok) {
    return { ok: false, error: versionCheck.error, status: 409 };
  }

  const manifest = await buildAcceptedRevisionManifest({
    manuscriptId: input.manuscriptId,
    includeDeferred: input.includeDeferred === true,
  });
  if (!manifest) return { ok: false, error: "Manuscript not found.", status: 404 };

  if (manifest.items.length === 0 && manifest.planningItems.length === 0) {
    return {
      ok: false,
      error:
        "No accepted revisions are ready to export. Review recommendations in the Revision Board and accept or edit the changes you want to keep.",
      status: 422,
    };
  }

  if (input.format === "json") {
    return {
      ok: true,
      body: generateStudioRevisionJsonExport(manifest),
      contentType: "application/json; charset=utf-8",
    };
  }

  return {
    ok: true,
    body: generateStudioRevisionMarkdownExport(manifest),
    contentType: "text/markdown; charset=utf-8",
  };
}
