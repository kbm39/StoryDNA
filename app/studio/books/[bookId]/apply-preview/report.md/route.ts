import { requireStudioAccess } from "@/lib/studio/access.ts";
import { generateStudioShadowPreview } from "@/app/studio/actions/shadow-preview.ts";
import { buildAcceptedRevisionManifest } from "@/lib/studio/revision-export-manifest.ts";
import { PRIVATE_EXPORT_CACHE_CONTROL } from "@/lib/studio/revision-export-filename.ts";
import {
  buildShadowPreviewFilename,
  generateShadowApplicationReportMarkdown,
} from "@/lib/studio/shadow-export.ts";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const { bookId } = await params;
  await requireStudioAccess(`/studio/books/${bookId}/apply-preview`);

  const url = new URL(request.url);
  const expectedActiveVersionId = url.searchParams.get("expectedActiveVersionId");
  const expectedDecisionSnapshotHash = url.searchParams.get("expectedDecisionSnapshotHash") ?? "";
  const selected = (url.searchParams.get("selected") ?? "").split(",").filter(Boolean);

  const manifest = await buildAcceptedRevisionManifest({ manuscriptId: bookId });
  if (!manifest) return new Response("Manuscript not found", { status: 404 });

  const result = await generateStudioShadowPreview({
    manuscriptId: bookId,
    expectedActiveVersionId,
    expectedDecisionSnapshotHash: expectedDecisionSnapshotHash || manifest.integrity.decisionSnapshotHash,
    selectedRevisionIds: selected.length ? selected : manifest.items.map((i) => i.revisionCandidateId),
    conflictResolutions: [],
  });

  if (!result.ok) return new Response(result.error, { status: 409 });

  const body = generateShadowApplicationReportMarkdown(result.shadow);
  const filename = buildShadowPreviewFilename(result.shadow.manuscript.title, result.shadow.generatedAt, "md").replace(
    "shadow-preview",
    "shadow-application-report",
  );

  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": PRIVATE_EXPORT_CACHE_CONTROL,
    },
  });
}
