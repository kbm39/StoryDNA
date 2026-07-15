import { Paragraph, TextRun, HeadingLevel } from "docx";

function parseInline(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) runs.push(new TextRun(text.slice(last, m.index)));
    if (m[2] !== undefined) runs.push(new TextRun({ text: m[2], bold: true }));
    else if (m[3] !== undefined) runs.push(new TextRun({ text: m[3], bold: true }));
    else if (m[4] !== undefined) runs.push(new TextRun({ text: m[4], italics: true }));
    else if (m[5] !== undefined) runs.push(new TextRun({ text: m[5], italics: true }));
    else if (m[6] !== undefined) runs.push(new TextRun({ text: m[6], font: "Courier New" }));
    last = regex.lastIndex;
  }
  if (last < text.length) runs.push(new TextRun(text.slice(last)));
  return runs.length > 0 ? runs : [new TextRun(text)];
}

/** Convert review memo Markdown into Word paragraphs. */
export function markdownToParagraphs(md: string): Paragraph[] {
  const out: Paragraph[] = [];
  for (const raw of md.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) continue;

    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      const level = m[1].length;
      const heading =
        level === 1
          ? HeadingLevel.HEADING_1
          : level === 2
            ? HeadingLevel.HEADING_2
            : HeadingLevel.HEADING_3;
      out.push(
        new Paragraph({
          heading,
          spacing: { before: 200, after: 80 },
          children: parseInline(m[2]),
        }),
      );
    } else if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      out.push(new Paragraph({ children: [new TextRun("")] }));
    } else if ((m = line.match(/^[-*]\s+(.*)$/))) {
      out.push(new Paragraph({ bullet: { level: 0 }, children: parseInline(m[1]) }));
    } else if ((m = line.match(/^(\d+)\.\s+(.*)$/))) {
      out.push(
        new Paragraph({
          indent: { left: 360 },
          spacing: { after: 40 },
          children: [new TextRun({ text: `${m[1]}. ` }), ...parseInline(m[2])],
        }),
      );
    } else {
      out.push(new Paragraph({ spacing: { after: 80 }, children: parseInline(line) }));
    }
  }
  return out;
}
