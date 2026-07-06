import { getManuscriptMeta, getManuscriptText } from "@/lib/reviews";
import { buildSubmissionFormatDocx, safeManuscriptFileName } from "@/lib/export";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [manuscript, text] = await Promise.all([getManuscriptMeta(id), getManuscriptText(id)]);
  if (!manuscript) return new Response("Not found", { status: 404 });
  if (!text || !text.trim()) return new Response("This manuscript has no extracted text.", { status: 400 });

  const buffer = await buildSubmissionFormatDocx(manuscript.title, text, manuscript.word_count);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": DOCX_MIME,
      "Content-Disposition": `attachment; filename="${safeManuscriptFileName(manuscript.title)}_Manuscript_Format.docx"`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
