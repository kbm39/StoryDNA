import { getManuscriptMeta } from "@/lib/reviews";
import { listIssues } from "@/lib/issues";
import { buildIssuesChecklistDocx, safeDocxName } from "@/lib/export";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const manuscript = await getManuscriptMeta(id);
  if (!manuscript) {
    return new Response("Manuscript not found", { status: 404 });
  }

  const issues = await listIssues(id);
  const buffer = await buildIssuesChecklistDocx(manuscript.title, issues);
  const filename = safeDocxName(manuscript.title);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": DOCX_MIME,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
