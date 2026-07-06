import { getManuscriptMeta } from "@/lib/reviews";
import {
  getEditorialAnalysis,
  listEditorialComments,
  listAssessmentsForComments,
  listSuggestionsForComments,
  groupAssessmentsByComment,
  groupSuggestionsByComment,
} from "@/lib/editorial";
import { buildMarkdownDocx } from "@/lib/export";
import type { CommentStance, Provider } from "@/lib/types";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const PROVIDER_LABEL: Record<Provider, string> = { openai: "OpenAI", anthropic: "Claude" };
const STANCE_LABEL: Record<CommentStance, string> = {
  agree: "Agrees",
  disagree: "Disagrees",
  partial: "Partly agrees",
};

function safeName(s: string): string {
  return (s || "manuscript").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(0, 80);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [manuscript, analysis] = await Promise.all([
    getManuscriptMeta(id),
    getEditorialAnalysis(id),
  ]);
  if (!manuscript || !analysis) return new Response("Not found", { status: 404 });

  const comments = await listEditorialComments(analysis.id);
  const commentIds = comments.map((c) => c.id);
  const [assessments, suggestions] = await Promise.all([
    listAssessmentsForComments(commentIds),
    listSuggestionsForComments(commentIds),
  ]);
  const byComment = groupAssessmentsByComment(assessments);
  const suggestionsByComment = groupSuggestionsByComment(suggestions);

  const lines: string[] = [`# ${manuscript.title} — Editorial analysis`, ""];
  if (analysis.file_name) lines.push(`*Source: ${analysis.file_name}*`, "");

  comments.forEach((c, i) => {
    lines.push(`## ${i + 1}. ${c.comment}`);
    if (c.category) lines.push(`*${c.category}*`);
    if (c.quote) lines.push("", `> ${c.quote}`);
    lines.push("");
    const verdicts = byComment.get(c.id) ?? [];
    for (const provider of ["openai", "anthropic"] as Provider[]) {
      const v = verdicts.find((a) => a.provider === provider);
      if (v) {
        lines.push(`- **${PROVIDER_LABEL[provider]}:** ${STANCE_LABEL[v.stance]}${v.reasoning ? ` — ${v.reasoning}` : ""}`);
      }
    }
    const sugg = suggestionsByComment.get(c.id) ?? [];
    if (sugg.length > 0) {
      lines.push("", "**Suggested fixes:**");
      for (const s of sugg) {
        lines.push("", `*${PROVIDER_LABEL[s.provider] ?? s.provider}:*`, "", s.content);
      }
    }
    lines.push("");
  });

  const buffer = await buildMarkdownDocx(lines.join("\n"));

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": DOCX_MIME,
      "Content-Disposition": `attachment; filename="${safeName(manuscript.title)}_Editorial-analysis.docx"`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
