import { getManuscriptMeta } from "@/lib/reviews";
import { getQueryLetter } from "@/lib/queries";
import { buildMarkdownDocx, safeReviewName } from "@/lib/export";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; qid: string }> },
) {
  const { id, qid } = await params;
  const [manuscript, query] = await Promise.all([getManuscriptMeta(id), getQueryLetter(qid)]);
  if (!manuscript || !query) {
    return new Response("Not found", { status: 404 });
  }

  const label = `Query to ${query.agent_name ?? "agent"}`;
  const buffer = await buildMarkdownDocx(query.content);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": DOCX_MIME,
      "Content-Disposition": `attachment; filename="${safeReviewName(manuscript.title, label)}"`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
