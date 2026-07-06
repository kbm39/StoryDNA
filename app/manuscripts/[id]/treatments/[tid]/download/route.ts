import { getManuscriptMeta } from "@/lib/reviews";
import { getTreatment } from "@/lib/treatments";
import { buildMarkdownDocx, safeTreatmentName } from "@/lib/export";
import { TREATMENT_FORMAT_LABEL, type TreatmentFormat } from "@/lib/ai/shared";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; tid: string }> },
) {
  const { id, tid } = await params;
  const [manuscript, treatment] = await Promise.all([getManuscriptMeta(id), getTreatment(tid)]);
  if (!manuscript || !treatment) {
    return new Response("Not found", { status: 404 });
  }

  const label = TREATMENT_FORMAT_LABEL[treatment.format as TreatmentFormat] ?? "Screen";
  const buffer = await buildMarkdownDocx(treatment.content);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": DOCX_MIME,
      "Content-Disposition": `attachment; filename="${safeTreatmentName(manuscript.title, label)}"`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
