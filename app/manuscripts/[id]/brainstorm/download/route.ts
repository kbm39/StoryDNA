import { getManuscriptMeta } from "@/lib/reviews";
import { listBrainstorms, groupByPrompt } from "@/lib/brainstorms";
import { buildMarkdownDocx } from "@/lib/export";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const PROVIDER_LABEL: Record<string, string> = { openai: "OpenAI", anthropic: "Claude" };

function safeName(s: string): string {
  return (s || "manuscript").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(0, 80);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [manuscript, brainstorms] = await Promise.all([
    getManuscriptMeta(id),
    listBrainstorms(id),
  ]);
  if (!manuscript) return new Response("Not found", { status: 404 });
  const rounds = groupByPrompt(brainstorms);
  if (rounds.length === 0) return new Response("No brainstorms yet", { status: 404 });

  const lines: string[] = [`# ${manuscript.title} — Scene brainstorming`, ""];
  for (const round of rounds) {
    lines.push(`## ${round.prompt}`, "");
    for (const b of round.items) {
      lines.push(
        `### ${PROVIDER_LABEL[b.provider] ?? b.provider}${b.model ? ` · ${b.model}` : ""}${b.selected ? " · ★ selected" : ""}`,
        "",
        b.content,
        "",
      );
    }
  }

  const buffer = await buildMarkdownDocx(lines.join("\n"));

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": DOCX_MIME,
      "Content-Disposition": `attachment; filename="${safeName(manuscript.title)}_Brainstorming.docx"`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
