import { getManuscriptMeta } from "@/lib/reviews";
import { listRevisionChecks } from "@/lib/revisions";
import { buildMarkdownDocx } from "@/lib/export";
import type { Provider } from "@/lib/types";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const PROVIDER_LABEL: Record<string, string> = { openai: "OpenAI", anthropic: "Claude" };

function safeName(s: string): string {
  return (s || "manuscript").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(0, 80);
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [manuscript, checks] = await Promise.all([
    getManuscriptMeta(id),
    listRevisionChecks(id),
  ]);
  if (!manuscript) return new Response("Not found", { status: 404 });
  if (checks.length === 0) return new Response("No revision checks yet", { status: 404 });

  const lines: string[] = [`# ${manuscript.title} — Revisions & score`, ""];

  checks.forEach((c, i) => {
    const provider = PROVIDER_LABEL[c.provider as Provider] ?? c.provider;
    lines.push(
      `## ${i === 0 ? "Latest re-check" : `Re-check ${checks.length - i}`} — Grade ${c.grade ?? "—"}`,
    );
    lines.push(
      `*${provider}${c.model ? ` · ${c.model}` : ""} · ${fmt(c.created_at)} · ${c.resolved_count} resolved · ${c.outstanding_count} outstanding*`,
      "",
    );
    if (c.summary) lines.push(c.summary, "");
    if (c.issue_verdicts && c.issue_verdicts.length > 0) {
      for (const v of c.issue_verdicts) {
        const mark = v.status === "resolved" ? "☑" : "☐";
        lines.push(`- ${mark} ${v.title ? `**${v.title}.** ` : ""}${v.note}`);
      }
      lines.push("");
    }
  });

  const buffer = await buildMarkdownDocx(lines.join("\n"));

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": DOCX_MIME,
      "Content-Disposition": `attachment; filename="${safeName(manuscript.title)}_Revisions.docx"`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
