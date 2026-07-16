import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} from "docx";
import type { AuthoritativeReviewDisplay } from "./authoritative-review-display.ts";
import { formatRecommendationLabel } from "./grading-explanation-display.ts";
import type { RetainedDeductionDisplay } from "./grading-explanation-display.ts";
import { appendProvenanceToDocxLines } from "./literary-agent-docx-provenance.ts";
import { markdownToParagraphs } from "./docx-markdown.ts";

function fmt(n: number): string {
  return n.toFixed(1).replace(/\.0$/, "");
}

function heading(text: string, level = HeadingLevel.HEADING_2): Paragraph {
  return new Paragraph({
    heading: level,
    spacing: { before: 240, after: 80 },
    children: [new TextRun(text)],
  });
}

function body(text: string, opts: { bold?: boolean; italics?: boolean; color?: string } = {}): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text, ...opts })],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60 },
    children: [new TextRun(text)],
  });
}

function deductionParagraphs(d: RetainedDeductionDisplay): Paragraph[] {
  const lines = [
    `${d.root_issue} — ${d.category_name} (${fmt(d.points_deducted)} pts deducted, confidence: ${d.confidence})`,
    `Criticism: ${d.criticism}`,
    `Why this remains: ${d.why_remains}`,
    `Improvement action: ${d.improvement_action}`,
  ];
  if (d.current_evidence.length > 0) {
    lines.push(`Current evidence: ${d.current_evidence.slice(0, 2).join(" | ")}`);
  }
  if (d.contrary_evidence.length > 0) {
    lines.push(`Contrary evidence: ${d.contrary_evidence.slice(0, 2).join(" | ")}`);
  }
  return lines.map((line) => bullet(line));
}

/** Plain-text section snapshot for tests (no DOCX packing). */
export function buildLiteraryAgentReviewDocxText(display: AuthoritativeReviewDisplay): string {
  const g = display.grading;
  const adj = g.adjustments;
  const lines: string[] = [
    display.manuscript_title,
    `${display.review_type_label} · ${display.provider_label}`,
    ...appendProvenanceToDocxLines(display),
  ];
  lines.push(
    `${display.canonical_word_count.toLocaleString()} words`,
    `${fmt(g.total_score)} / ${g.total_max} — ${g.descriptive_band}`,
    `Craft: ${fmt(g.craft_score)} / ${g.craft_max}`,
    `Acquisition readiness: ${fmt(g.acquisition_score)} / ${g.acquisition_max}`,
    `Recommendation: ${formatRecommendationLabel(g.recommendation)}`,
    "Why this manuscript received this assessment",
  );
  if (adj) {
    lines.push(
      "Adjustments made by StoryDNA validation",
      `Raw model score: ${fmt(adj.raw_model_score ?? 0)}`,
      `Normalized application score: ${fmt(adj.normalized_application_score ?? g.total_score)}`,
    );
  }
  if (display.assessment_mode_label) {
    lines.push(`Assessment mode: ${display.assessment_mode_label}`);
  }
  lines.push(display.methodology_disclaimer);
  for (const d of g.retained_deductions) {
    lines.push(d.root_issue);
  }
  lines.push(display.memo_content);
  return lines.join("\n");
}

/** Build authoritative Literary Agent review DOCX from the shared display model. */
export async function buildLiteraryAgentReviewDocx(
  display: AuthoritativeReviewDisplay,
): Promise<Buffer> {
  const g = display.grading;
  const adj = g.adjustments;

  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun(display.manuscript_title)],
    }),
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({ text: display.review_type_label, bold: true }),
        new TextRun({ text: ` · ${display.provider_label}`, color: "888888" }),
      ],
    }),
    heading("Review provenance", HeadingLevel.HEADING_2),
    ...appendProvenanceToDocxLines(display).flatMap((line) => {
      if (line.startsWith("---")) return [];
      if (line === display.provenance.historical_disclaimer) {
        return [
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({ text: line, bold: true, color: "AA5500" }),
            ],
          }),
        ];
      }
      return [body(line, { color: "666666" })];
    }),
  ];

  children.push(
    body(`${display.canonical_word_count.toLocaleString()} words`),
    new Paragraph({
      spacing: { before: 120, after: 80 },
      children: [
        new TextRun({
          text: `${fmt(g.total_score)} / ${g.total_max} — ${g.descriptive_band}`,
          bold: true,
          size: 28,
        }),
      ],
    }),
  );

  if (g.letter_grade_secondary) {
    children.push(
      body(`Academic-style equivalent: ${g.letter_grade_secondary} — not a publishing-industry standard.`, {
        italics: true,
        color: "888888",
      }),
    );
  }

  children.push(
    body(`Craft: ${fmt(g.craft_score)} / ${g.craft_max}`),
    body(`Acquisition readiness: ${fmt(g.acquisition_score)} / ${g.acquisition_max}`),
    body(`Recommendation: ${formatRecommendationLabel(g.recommendation)}`, { bold: true }),
  );

  children.push(heading("Why this manuscript received this assessment"));

  if (g.strongest_categories.length > 0) {
    children.push(body("Strongest categories:", { bold: true }));
    for (const c of g.strongest_categories) {
      children.push(bullet(`${c.name}: ${fmt(c.earned)} / ${c.max}`));
    }
  }
  if (g.weakest_categories.length > 0) {
    children.push(body("Categories needing the most revision:", { bold: true }));
    for (const c of g.weakest_categories) {
      children.push(
        bullet(`${c.name}: ${fmt(c.earned)} / ${c.max} (${fmt(c.deduction)} pts deducted)`),
      );
    }
  }

  if (g.retained_deductions.length > 0) {
    children.push(body("Retained deductions and improvement paths:", { bold: true }));
    for (const d of g.retained_deductions) {
      children.push(...deductionParagraphs(d));
    }
  } else {
    children.push(body("No scored deductions remain after StoryDNA validation."));
  }

  if (adj) {
    children.push(heading("Adjustments made by StoryDNA validation"));
    const adjLines = [
      `Raw model score: ${fmt(adj.raw_model_score ?? 0)}`,
      `Normalized application score: ${fmt(adj.normalized_application_score ?? g.total_score)}`,
      `Duplicate deductions removed: ${adj.duplicate_deductions_removed}`,
      `Duplicate points removed: ${fmt(adj.duplicate_points_removed)}`,
      `Repeated evidence removed: ${adj.repeated_evidence_removed}`,
      `Valid deductions retained: ${fmt(adj.valid_deductions_retained)}`,
      `Mechanically recoverable: ${fmt(adj.mechanically_recoverable_points)} pts`,
      `Evidence-ceiling reductions: ${fmt(adj.evidence_ceiling_reductions)} pts`,
      `Unsupported in final Call B rubric: ${adj.unsupported_deductions_removed}`,
      `Root-issue cap reductions: ${adj.root_issue_cap_reductions}`,
    ];
    for (const line of adjLines) children.push(bullet(line));
    children.push(body(display.normalization_authority_note, { italics: true }));
  }

  if (display.assessment_mode_label) {
    children.push(
      heading("Assessment mode"),
      body(`Assessment mode: ${display.assessment_mode_label}`, { bold: true }),
    );
    if (g.comparison_mode === "SAME_VERSION_REASSESSMENT") {
      children.push(
        body(
          "This review reassessed prior deductions against evidence already present in the same manuscript version. It is not a before-and-after revision comparison.",
        ),
      );
    }
  }

  children.push(
    heading("Contrary-evidence summary"),
    bullet(`Gate status: ${display.contrary_evidence_summary.gate_status ?? "n/a"}`),
    bullet(`Concern assessments: ${display.contrary_evidence_summary.assessment_count}`),
    bullet(`Retained concerns: ${display.contrary_evidence_summary.retained_concern_count}`),
    heading("Methodology"),
    body(display.methodology_disclaimer, { italics: true }),
    heading("Review narrative"),
    ...markdownToParagraphs(display.memo_content),
    new Paragraph({
      spacing: { before: 240 },
      children: [
        new TextRun({
          text: `StoryDNA review ${display.review_id} · ${display.canonical_word_count.toLocaleString()} words · normalized ${fmt(g.total_score)} / ${g.total_max}`,
          italics: true,
          color: "888888",
        }),
      ],
    }),
  );

  const doc = new Document({
    description: `StoryDNA review ${display.review_id}`,
    subject: display.review_id,
    title: `${display.manuscript_title} — ${display.review_type_label}`,
    sections: [{ children }],
  });

  return Packer.toBuffer(doc);
}
