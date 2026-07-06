import { getSupabaseAdmin, MANUSCRIPTS_BUCKET } from "@/lib/supabase/server";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function asciiName(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._ -]+/g, "").trim() || "manuscript.docx";
  return base.toLowerCase().endsWith(".docx") ? base : `${base}.docx`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: manuscript, error } = await supabase
    .from("manuscripts")
    .select("storage_path, original_filename")
    .eq("id", id)
    .maybeSingle();
  if (error) return new Response(error.message, { status: 500 });
  if (!manuscript) return new Response("Manuscript not found", { status: 404 });

  const { data: blob, error: dlErr } = await supabase.storage
    .from(MANUSCRIPTS_BUCKET)
    .download(manuscript.storage_path);
  if (dlErr || !blob) return new Response("File not found", { status: 404 });

  const buffer = Buffer.from(await blob.arrayBuffer());

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": DOCX_MIME,
      "Content-Disposition": `attachment; filename="${asciiName(manuscript.original_filename)}"`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
