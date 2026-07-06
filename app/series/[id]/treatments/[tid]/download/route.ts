import { getSeries } from "@/lib/series";
import { getTreatment } from "@/lib/treatments";
import { buildMarkdownDocx } from "@/lib/export";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function safeName(title: string): string {
  return (title || "series").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(0, 80);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; tid: string }> },
) {
  const { id, tid } = await params;
  const [series, treatment] = await Promise.all([getSeries(id), getTreatment(tid)]);
  if (!series || !treatment) return new Response("Not found", { status: 404 });

  const buffer = await buildMarkdownDocx(treatment.content);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": DOCX_MIME,
      "Content-Disposition": `attachment; filename="${safeName(series.title)}_Series_Treatment.docx"`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
