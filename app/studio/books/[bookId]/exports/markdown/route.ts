import { requireStudioAccess } from "@/lib/studio/access.ts";
import { buildStudioRevisionExportForDownload } from "@/app/studio/actions/revision-export.ts";
import {
  buildStudioRevisionMarkdownFilename,
  buildStudioRevisionPlanningMarkdownFilename,
  PRIVATE_EXPORT_CACHE_CONTROL,
} from "@/lib/studio/revision-export-filename.ts";
import { buildAcceptedRevisionManifest } from "@/lib/studio/revision-export-manifest.ts";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const { bookId } = await params;
  await requireStudioAccess(`/studio/books/${bookId}/exports`);

  const url = new URL(request.url);
  const expectedActiveVersionId = url.searchParams.get("expectedActiveVersionId");
  const includeDeferred = url.searchParams.get("includeDeferred") === "true";

  const result = await buildStudioRevisionExportForDownload({
    manuscriptId: bookId,
    expectedActiveVersionId,
    includeDeferred,
    format: "markdown",
  });

  if (!result.ok) {
    return new Response(result.error, { status: result.status });
  }

  const manifest = await buildAcceptedRevisionManifest({
    manuscriptId: bookId,
    includeDeferred,
  });
  const title = manifest?.manuscript.title ?? "manuscript";
  const generatedAt = manifest?.generatedAt ?? new Date().toISOString();
  const filename = includeDeferred
    ? buildStudioRevisionPlanningMarkdownFilename(title, generatedAt)
    : buildStudioRevisionMarkdownFilename(title, generatedAt);

  return new Response(result.body, {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": PRIVATE_EXPORT_CACHE_CONTROL,
    },
  });
}
