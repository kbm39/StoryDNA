import { getManuscriptMeta } from "@/lib/reviews";
import { getDocument } from "@/lib/documents";
import { buildMarkdownDocx } from "@/lib/export";
import { DOC_SPECS } from "@/lib/ai/shared";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function safeName(s: string): string {
  return (s || "document").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(0, 80);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const { id, docId } = await params;
  const [manuscript, doc] = await Promise.all([getManuscriptMeta(id), getDocument(docId)]);
  if (!manuscript || !doc) return new Response("Not found", { status: 404 });

  const label = DOC_SPECS[doc.doc_type]?.label ?? "Document";
  const buffer = await buildMarkdownDocx(doc.content);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": DOCX_MIME,
      "Content-Disposition": `attachment; filename="${safeName(manuscript.title)}_${safeName(label)}.docx"`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
