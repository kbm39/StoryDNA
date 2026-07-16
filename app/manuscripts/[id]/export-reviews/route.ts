import { getManuscriptMeta, listReviews } from "@/lib/reviews";
import { listConcernAssessmentsForReview } from "@/lib/concern-assessments";
import { resolveAuthoritativeReviewForDisplay } from "@/lib/authoritative-review-resolve";
import {
  buildAuthoritativeReviewDisplay,
  validateAuthoritativeExport,
  EXPORT_BLOCKED_MESSAGE,
} from "@/lib/authoritative-review-display";
import { buildLiteraryAgentReviewDocxText } from "@/lib/literary-agent-docx";
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
  const craft = reviews.find((r) => r.perspective === "craft");
  const screen = reviews.filter((r) => r.perspective === "screen");
  const providerLabel: Record<string, string> = { openai: "OpenAI", anthropic: "Claude" };

  const sections: ReviewSection[] = [];

  try {
    const resolved = await resolveAuthoritativeReviewForDisplay(id, "commercial");
    const assessments = await listConcernAssessmentsForReview(resolved.review.id);
    const display = buildAuthoritativeReviewDisplay({
      review: resolved.review,
      manuscriptTitle: resolved.manuscriptTitle,
      assessments,
      fallbackWordCount: resolved.fallbackWordCount,
      isHistorical: resolved.isHistorical,
      currentVersionId: resolved.currentVersionId,
      authoritativeReviewId: resolved.review.id,
    });
    if (!display) {
      return new Response(EXPORT_BLOCKED_MESSAGE, { status: 422 });
    }
    const validation = validateAuthoritativeExport(display, { requireActive: true });
    if (!validation.ok) {
      return new Response(EXPORT_BLOCKED_MESSAGE, { status: 422 });
    }
    sections.push({
      heading: "Literary-agent view",
      subheading: `Authoritative active review · ${display.review_id} · ${display.provenance.generated_at}`,
      content: buildLiteraryAgentReviewDocxText(display),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to resolve active commercial review";
    return new Response(message, { status: 422 });
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
      heading: "Producer's read · TV / film",
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
