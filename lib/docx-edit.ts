import "server-only";
import JSZip from "jszip";

export interface DocxEdit {
  find: string;
  replace: string;
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Concatenated visible text of a single <w:p> paragraph block. */
function paragraphText(block: string): string {
  let out = "";
  const re = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) out += m[1];
  return decodeXml(out);
}

/** A regex from `find` that tolerates whitespace/newline differences. */
function flexibleRegex(find: string): RegExp | null {
  const trimmed = find.trim();
  if (!trimmed) return null;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(escaped);
}

/** Build a single run (with line breaks) for the rewritten paragraph text. */
function runXml(text: string): string {
  const segments = text.split("\n").map((s) => `<w:t xml:space="preserve">${escapeXml(s)}</w:t>`);
  return `<w:r>${segments.join("<w:br/>")}</w:r>`;
}

/** Apply one find/replace to the first matching paragraph; null if not found. */
function applyOne(xml: string, edit: DocxEdit): string | null {
  const re = flexibleRegex(edit.find);
  if (!re) return null;

  const paraRe = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
  let match: RegExpExecArray | null;
  while ((match = paraRe.exec(xml)) !== null) {
    const block = match[0];
    const text = paragraphText(block);
    if (!re.test(text)) continue;

    const newText = text.replace(re, edit.replace);
    const openTag = block.match(/^<w:p\b[^>]*>/)![0];
    const pPr = (block.match(/<w:pPr>[\s\S]*?<\/w:pPr>/) || [""])[0];
    const newBlock = `${openTag}${pPr}${runXml(newText)}</w:p>`;
    return xml.slice(0, match.index) + newBlock + xml.slice(match.index + block.length);
  }
  return null;
}

/**
 * Apply find/replace edits to a .docx, paragraph by paragraph. The matched
 * paragraph is rebuilt as a single run (inline formatting within it is
 * flattened); every other paragraph is left byte-identical.
 */
export async function applyEditsToDocx(
  input: Buffer,
  edits: DocxEdit[],
): Promise<{ buffer: Buffer; applied: DocxEdit[]; failed: DocxEdit[] }> {
  const zip = await JSZip.loadAsync(input);
  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new Error("Not a valid .docx (missing word/document.xml).");

  let xml = await docFile.async("string");
  const applied: DocxEdit[] = [];
  const failed: DocxEdit[] = [];

  for (const edit of edits) {
    const next = applyOne(xml, edit);
    if (next) {
      xml = next;
      applied.push(edit);
    } else {
      failed.push(edit);
    }
  }

  zip.file("word/document.xml", xml);
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return { buffer, applied, failed };
}
