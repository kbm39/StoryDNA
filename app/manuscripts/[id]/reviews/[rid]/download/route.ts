import { getManuscriptMeta, getReview } from "@/lib/reviews";
import { buildMarkdownDocx, safeReviewName } from "@/lib/export";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const PERSPECTIVE_LABEL: Record<string, string> = {
  commercial: "Literary-agent review",
  craft: "Developmental edit",
  screen: "Producer’s read",
};
const PROVIDER_LABEL: Record<string, string> = { openai: "OpenAI", anthropic: "Claude" };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; rid: string }> },
) {
  const { id, rid } = await params;
  const [manuscript, review] = await Promise.all([getManuscriptMeta(id), getReview(rid)]);
  if (!manuscript || !review) {
    return new Response("Not found", { status: 404 });
  }

  const label = `${PERSPECTIVE_LABEL[review.perspective] ?? review.perspective} (${
    PROVIDER_LABEL[review.provider] ?? review.provider
  })`;
  const buffer = await buildMarkdownDocx(review.content);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": DOCX_MIME,
      "Content-Disposition": `attachment; filename="${safeReviewName(manuscript.title, label)}"`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
