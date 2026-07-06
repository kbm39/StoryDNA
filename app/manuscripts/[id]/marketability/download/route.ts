import { getManuscriptMeta } from "@/lib/reviews";
import { getMarketabilityReport } from "@/lib/marketability";
import { buildMarkdownDocx } from "@/lib/export";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function safeName(s: string): string {
  return (s || "manuscript").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(0, 80);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [manuscript, report] = await Promise.all([
    getManuscriptMeta(id),
    getMarketabilityReport(id),
  ]);
  if (!manuscript || !report) return new Response("Not found", { status: 404 });

  const body = report.summary || report.raw_text;
  const md = `# ${manuscript.title} — Marketability\n\n${body}`;
  const buffer = await buildMarkdownDocx(md);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": DOCX_MIME,
      "Content-Disposition": `attachment; filename="${safeName(manuscript.title)}_Marketability.docx"`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
