import { getManuscriptMeta, listReviews } from "@/lib/reviews";
import { activeCommercialReview } from "@/lib/review-selection";
import { buildReviewsDocx, safeReviewsName, type ReviewSection } from "@/lib/export";

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

  const reviews = await listReviews(id);
  const commercial = activeCommercialReview(reviews);
  const craft = reviews.find((r) => r.perspective === "craft");
  const screen = reviews.filter((r) => r.perspective === "screen");
  const providerLabel: Record<string, string> = { openai: "OpenAI", anthropic: "Claude" };

  // Commercial, then craft, then producer's read(s) — matching the on-screen order.
  const sections: ReviewSection[] = [];
  if (commercial) {
    sections.push({
      heading: "Literary-agent view",
      subheading: `OpenAI · commercial${commercial.model ? ` · ${commercial.model}` : ""}`,
      content: commercial.content,
    });
  }
  if (craft) {
    sections.push({
      heading: "Developmental edit",
      subheading: `Claude · craft${craft.model ? ` · ${craft.model}` : ""}`,
      content: craft.content,
    });
  }
  for (const r of screen) {
    sections.push({
      heading: "Producer’s read · TV / film",
      subheading: `${providerLabel[r.provider] ?? r.provider} · screen${r.model ? ` · ${r.model}` : ""}`,
      content: r.content,
    });
  }

  const buffer = await buildReviewsDocx(manuscript.title, sections);
  const filename = safeReviewsName(manuscript.title);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": DOCX_MIME,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
