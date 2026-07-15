import "server-only";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  PageBreak,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  Header,
  PageNumber,
  convertInchesToTwip,
} from "docx";
import type { Issue } from "@/lib/types";
import { GRADE_LEGEND, GRADE_LEGEND_NOTE } from "@/lib/grade-legend";
import { markdownToParagraphs } from "@/lib/docx-markdown";

const SOURCE_LABEL: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Claude",
};

function issueParagraphs(issue: Issue): Paragraph[] {
  const box = issue.status === "resolved" ? "☑" : "☐"; // ☑ / ☐
  const source = issue.source_provider ? SOURCE_LABEL[issue.source_provider] : "Manual";
  const meta = [source, issue.category].filter(Boolean).join(" · ");

  const paragraphs: Paragraph[] = [
    new Paragraph({
      spacing: { before: 160, after: 40 },
      children: [
        new TextRun({ text: `${box}  ` }),
        new TextRun({ text: issue.title, bold: true, strike: issue.status === "resolved" }),
        ...(meta ? [new TextRun({ text: `   [${meta}]`, italics: true, color: "888888" })] : []),
      ],
    }),
  ];

  if (issue.description) {
    paragraphs.push(
      new Paragraph({
        indent: { left: 360 },
        spacing: { after: 40 },
        children: [new TextRun({ text: issue.description })],
      }),
    );
  }
  return paragraphs;
}

/** Build a Word document of the issues checklist for a manuscript. */
export async function buildIssuesChecklistDocx(
  title: string,
  issues: Issue[],
): Promise<Buffer> {
  const outstanding = issues.filter((i) => i.status === "outstanding");
  const resolved = issues.filter((i) => i.status === "resolved");

  const generated = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const children: Paragraph[] = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(title)] }),
    new Paragraph({
      children: [
        new TextRun({ text: "Issues checklist", bold: true }),
        new TextRun({ text: `  ·  generated ${generated}`, color: "888888" }),
      ],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: `${outstanding.length} outstanding · ${resolved.length} resolved`,
          color: "888888",
        }),
      ],
    }),
  ];

  if (issues.length === 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: "No issues yet." })] }));
  } else {
    children.push(
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Outstanding")] }),
    );
    if (outstanding.length === 0) {
      children.push(new Paragraph({ children: [new TextRun({ text: "None.", italics: true })] }));
    } else {
      for (const issue of outstanding) children.push(...issueParagraphs(issue));
    }

    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240 },
        children: [new TextRun("Resolved")],
      }),
    );
    if (resolved.length === 0) {
      children.push(new Paragraph({ children: [new TextRun({ text: "None.", italics: true })] }));
    } else {
      for (const issue of resolved) children.push(...issueParagraphs(issue));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

/** Filesystem-safe base name for a downloaded file (ascii-only). */
function safeBase(title: string): string {
  return title.replace(/[^\w \-]+/g, "").trim().replace(/\s+/g, " ") || "manuscript";
}

export function safeDocxName(title: string): string {
  return `${safeBase(title)} - Issues.docx`;
}

export function safeReviewsName(title: string): string {
  return `${safeBase(title)} - Reviews.docx`;
}

export function safeTreatmentName(title: string, formatLabel: string): string {
  return `${safeBase(title)} - ${formatLabel} Treatment.docx`;
}

export function safeReviewName(title: string, label: string): string {
  return `${safeBase(title)} - ${label}.docx`;
}

/** Build a Word document from a single Markdown document (treatment or review). */
export async function buildMarkdownDocx(content: string): Promise<Buffer> {
  const generated = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const children: Paragraph[] = [
    ...markdownToParagraphs(content),
    new Paragraph({
      spacing: { before: 240 },
      children: [new TextRun({ text: `Generated ${generated}`, italics: true, color: "888888" })],
    }),
  ];
  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

// --- Standard manuscript (Shunn) format --------------------------------------
function approxWordCount(n: number): string {
  const rounded = n >= 10000 ? Math.round(n / 1000) * 1000 : Math.max(100, Math.round(n / 100) * 100);
  return rounded.toLocaleString();
}

/** Build a submission-ready .docx in standard manuscript format (Shunn-style):
 *  12pt Times New Roman, double-spaced, 1" margins, title page block, running
 *  header with page numbers, half-inch first-line indents, # scene breaks. */
export async function buildSubmissionFormatDocx(
  title: string,
  text: string,
  wordCount: number | null,
  author = "[Author Name]",
): Promise<Buffer> {
  const surname = author.trim().split(/\s+/).pop() || "[Surname]";
  const keyword = (title.match(/[A-Za-z]{4,}/)?.[0] ?? title ?? "TITLE").toUpperCase();
  const wc = wordCount ? `approx. ${approxWordCount(wordCount)} words` : "[word count]";
  const DOUBLE = 480;
  const INDENT = convertInchesToTwip(0.5);

  const single = (t: string, alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]) =>
    new Paragraph({ alignment, spacing: { line: 240, after: 0 }, children: [new TextRun(t)] });

  const front: Paragraph[] = [
    single(wc, AlignmentType.RIGHT),
    single("[Author Name]"),
    single("[Street Address]"),
    single("[City, State ZIP]"),
    single("[Email] · [Phone]"),
  ];

  // Push the title down ~1/3 of the page.
  for (let i = 0; i < 8; i++) front.push(new Paragraph({ children: [new TextRun("")] }));
  front.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: DOUBLE, after: 0 },
      children: [new TextRun({ text: title || "[Title]" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: DOUBLE, after: 0 },
      children: [new TextRun({ text: `by ${author}` })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  const body: Paragraph[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^(#|\*\s*\*\s*\*|\*{3,}|—{2,}|-{3,})$/.test(line)) {
      body.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { line: DOUBLE, after: 0 },
          children: [new TextRun("#")],
        }),
      );
      continue;
    }
    body.push(
      new Paragraph({
        spacing: { line: DOUBLE, after: 0 },
        indent: { firstLine: INDENT },
        children: [new TextRun(line)],
      }),
    );
  }

  const runningHeader = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun(`${surname} / ${keyword} / `),
          new TextRun({ children: [PageNumber.CURRENT] }),
        ],
      }),
    ],
  });

  const doc = new Document({
    styles: { default: { document: { run: { font: "Times New Roman", size: 24 } } } },
    sections: [
      {
        properties: {
          titlePage: true, // first page (title page) gets no running header
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        headers: { default: runningHeader, first: new Header({ children: [] }) },
        children: [...front, ...body],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

export function safeManuscriptFileName(title: string): string {
  return (title || "manuscript").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(0, 80);
}

export interface ReviewSection {
  heading: string;
  subheading?: string;
  content: string;
}

function cell(text: string, bold = false): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold })] })],
  });
}

/** A "Grade legend" heading (own page) + table + note, for the reviews export. */
function gradeLegendElements(): (Paragraph | Table)[] {
  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        cell("Grade", true),
        cell("Quality (craft)", true),
        cell("Marketability", true),
        cell("Closeness to submission", true),
      ],
    }),
    ...GRADE_LEGEND.map(
      (r) =>
        new TableRow({
          children: [cell(r.grade, true), cell(r.quality), cell(r.market), cell(r.submission)],
        }),
    ),
  ];

  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 120 },
      children: [new PageBreak(), new TextRun("Grade legend")],
    }),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }),
    new Paragraph({
      spacing: { before: 120 },
      children: [new TextRun({ text: GRADE_LEGEND_NOTE, italics: true, color: "888888" })],
    }),
  ];
}

/** Build a Word document of the editorial reviews for a manuscript. */
export async function buildReviewsDocx(
  title: string,
  sections: ReviewSection[],
): Promise<Buffer> {
  const generated = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const children: (Paragraph | Table)[] = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(title)] }),
    new Paragraph({
      spacing: { after: 160 },
      children: [new TextRun({ text: `Editorial reviews · generated ${generated}`, color: "888888" })],
    }),
  ];

  if (sections.length === 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: "No reviews generated yet." })] }));
  } else {
    sections.forEach((section, i) => {
      const heading = new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 40 },
        children: [
          // Each review starts on its own page (except the first).
          ...(i > 0 ? [new PageBreak()] : []),
          new TextRun(section.heading),
        ],
      });
      children.push(heading);
      if (section.subheading) {
        children.push(
          new Paragraph({
            spacing: { after: 120 },
            children: [new TextRun({ text: section.subheading, italics: true, color: "888888" })],
          }),
        );
      }
      children.push(...markdownToParagraphs(section.content));
    });
    children.push(...gradeLegendElements());
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
