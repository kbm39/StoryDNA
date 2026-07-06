import "server-only";
import JSZip from "jszip";

export interface DocxComment {
  /** Verbatim passage to anchor the comment to (matched within one paragraph). */
  anchor: string;
  author: string;
  initials: string;
  /** The comment body (may contain newlines). */
  body: string;
}

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const COMMENTS_CT =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml";
const COMMENTS_REL =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Concatenated visible text of a single <w:p> paragraph block. */
function paragraphText(block: string): string {
  let out = "";
  const re = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) out += m[1];
  return decodeXml(out);
}

/** A regex from `anchor` that tolerates whitespace/newline differences. */
function flexibleRegex(anchor: string): RegExp | null {
  const trimmed = anchor.trim();
  if (!trimmed) return null;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(escaped);
}

/** The comment body as one or more paragraphs for comments.xml. */
function bodyParagraphs(body: string): string {
  const lines = body.split("\n");
  return lines
    .map(
      (line) =>
        `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`,
    )
    .join("");
}

/** Wrap the whole matching paragraph's content in a comment range; null if not found. */
function anchorParagraph(xml: string, anchor: string, id: number): string | null {
  const re = flexibleRegex(anchor);
  if (!re) return null;

  const paraRe = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
  let match: RegExpExecArray | null;
  while ((match = paraRe.exec(xml)) !== null) {
    const block = match[0];
    if (!re.test(paragraphText(block))) continue;

    const openTag = block.match(/^<w:p\b[^>]*>/)![0];
    const inner = block.slice(openTag.length, block.length - "</w:p>".length);
    const pPr = (inner.match(/^<w:pPr>[\s\S]*?<\/w:pPr>/) || [""])[0];
    const runs = inner.slice(pPr.length);

    const rangeStart = `<w:commentRangeStart w:id="${id}"/>`;
    const rangeEnd = `<w:commentRangeEnd w:id="${id}"/>`;
    const reference = `<w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="${id}"/></w:r>`;
    const newBlock = `${openTag}${pPr}${rangeStart}${runs}${rangeEnd}${reference}</w:p>`;
    return xml.slice(0, match.index) + newBlock + xml.slice(match.index + block.length);
  }
  return null;
}

/** Highest existing w:comment id in an existing comments.xml part, or -1. */
function maxCommentId(commentsXml: string): number {
  let max = -1;
  const re = /<w:comment\b[^>]*\bw:id="(\d+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(commentsXml)) !== null) max = Math.max(max, Number(m[1]));
  return max;
}

function ensureContentType(typesXml: string): string {
  if (typesXml.includes('PartName="/word/comments.xml"')) return typesXml;
  const override = `<Override PartName="/word/comments.xml" ContentType="${COMMENTS_CT}"/>`;
  return typesXml.replace("</Types>", `${override}</Types>`);
}

function ensureRelationship(relsXml: string): string {
  if (relsXml.includes(COMMENTS_REL)) return relsXml;
  // Pick an Id that doesn't collide with existing rIdN values.
  let max = 0;
  const re = /Id="rId(\d+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(relsXml)) !== null) max = Math.max(max, Number(m[1]));
  const rel = `<Relationship Id="rId${max + 1}" Type="${COMMENTS_REL}" Target="comments.xml"/>`;
  return relsXml.replace("</Relationships>", `${rel}</Relationships>`);
}

/**
 * Insert Word margin comments into a .docx. Each comment is anchored to the
 * first paragraph whose visible text contains its `anchor`. The prose itself is
 * left unchanged — only comment markup is added. Comments that can't be located
 * are returned in `failed`.
 */
export async function insertCommentsIntoDocx(
  input: Buffer,
  comments: DocxComment[],
  date: string,
): Promise<{ buffer: Buffer; applied: DocxComment[]; failed: DocxComment[] }> {
  const zip = await JSZip.loadAsync(input);
  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new Error("Not a valid .docx (missing word/document.xml).");

  let xml = await docFile.async("string");

  const existingComments = zip.file("word/comments.xml");
  const existingXml = existingComments ? await existingComments.async("string") : "";
  let nextId = maxCommentId(existingXml) + 1;

  const applied: DocxComment[] = [];
  const failed: DocxComment[] = [];
  const newEntries: string[] = [];

  for (const c of comments) {
    const id = nextId;
    const next = anchorParagraph(xml, c.anchor, id);
    if (!next) {
      failed.push(c);
      continue;
    }
    xml = next;
    nextId += 1;
    newEntries.push(
      `<w:comment w:id="${id}" w:author="${escapeXml(c.author)}" w:date="${escapeXml(date)}" w:initials="${escapeXml(c.initials)}">${bodyParagraphs(c.body)}</w:comment>`,
    );
    applied.push(c);
  }

  if (applied.length === 0) {
    return { buffer: input, applied, failed };
  }

  // Merge into (or create) comments.xml.
  let commentsXml: string;
  if (existingXml) {
    commentsXml = existingXml.replace("</w:comments>", `${newEntries.join("")}</w:comments>`);
  } else {
    commentsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:comments xmlns:w="${W_NS}">${newEntries.join("")}</w:comments>`;
  }

  zip.file("word/document.xml", xml);
  zip.file("word/comments.xml", commentsXml);

  const typesFile = zip.file("[Content_Types].xml");
  if (typesFile) {
    zip.file("[Content_Types].xml", ensureContentType(await typesFile.async("string")));
  }

  const relsFile = zip.file("word/_rels/document.xml.rels");
  if (relsFile) {
    zip.file("word/_rels/document.xml.rels", ensureRelationship(await relsFile.async("string")));
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return { buffer, applied, failed };
}
