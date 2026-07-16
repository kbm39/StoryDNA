import { getManuscriptMeta, getReview } from "@/lib/reviews";
import { listConcernAssessmentsForReview } from "@/lib/concern-assessments";
import { resolveAuthoritativeReviewForDisplay } from "@/lib/authoritative-review-resolve";
import {
  buildAuthoritativeReviewDisplay,
  validateAuthoritativeExport,
  EXPORT_BLOCKED_MESSAGE,
} from "@/lib/authoritative-review-display";
import { buildLiteraryAgentReviewDocx } from "@/lib/literary-agent-docx";
import { buildMarkdownDocx, safeReviewName } from "@/lib/export";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const PERSPECTIVE_LABEL: Record<string, string> = {
  commercial: "Literary-agent review",
  craft: "Developmental edit",
  screen: "Producer's read",
};
const PROVIDER_LABEL: Record<string, string> = { openai: "OpenAI", anthropic: "Claude" };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; rid: string }> },
) {
  const { id, rid } = await params;
  const [manuscript, review] = await Promise.all([getManuscriptMeta(id), getReview(rid)]);
  if (!manuscript || !review || review.manuscript_id !== id) {
    return new Response("Not found", { status: 404 });
  }

  if (review.perspective === "commercial") {
    let resolved;
    let authoritativeReviewId: string | null = null;
    try {
      resolved = await resolveAuthoritativeReviewForDisplay(id, "commercial", rid);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to resolve review";
      return new Response(message, { status: 422 });
    }

    try {
      const defaultResolved = await resolveAuthoritativeReviewForDisplay(id, "commercial");
      authoritativeReviewId = defaultResolved.review.id;
    } catch {
      authoritativeReviewId = null;
    }

    const assessments = await listConcernAssessmentsForReview(rid);
    const display = buildAuthoritativeReviewDisplay({
      review: resolved.review,
      manuscriptTitle: resolved.manuscriptTitle,
      assessments,
      fallbackWordCount: resolved.fallbackWordCount,
      isHistorical: resolved.isHistorical,
      currentVersionId: resolved.currentVersionId,
      authoritativeReviewId,
    });
    if (!display) {
      return new Response(EXPORT_BLOCKED_MESSAGE, { status: 422 });
    }

    const validation = validateAuthoritativeExport(display, {
      requireActive: !display.is_historical,
    });
    if (!validation.ok) {
      return new Response(EXPORT_BLOCKED_MESSAGE, { status: 422 });
    }

    const buffer = await buildLiteraryAgentReviewDocx(display);
    const label = `${PERSPECTIVE_LABEL.commercial} (${PROVIDER_LABEL[review.provider] ?? review.provider})`;
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": DOCX_MIME,
        "Content-Disposition": `attachment; filename="${safeReviewName(manuscript.title, label)}"`,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
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
