import type { RubricCategoryScore } from "../commercial-fiction-rubric.ts";
import type {
  EditorialIssueRecord,
  PriorConcern,
  PriorReviewBundle,
  RevisionCandidateRecord,
} from "./types.ts";
import { dedupeId, slugFromText } from "./slug.ts";

const MEMO_WEAKNESS_HEADINGS = [
  /^##\s*weaknesses?\b/im,
  /^##\s*areas?\s+for\s+improvement\b/im,
  /^##\s*revision\s+priorities\b/im,
];

const STOP_WORDS = new Set([
  "the", "and", "for", "that", "with", "this", "from", "have", "been", "were",
  "their", "they", "when", "what", "which", "while", "where", "into", "about",
  "than", "then", "does", "still", "very", "more", "most", "some", "such",
]);

export interface ExtractionResult {
  concerns: PriorConcern[];
  memo_fallback_used: boolean;
  structured_count: number;
}

export function extractPriorConcerns(bundle: PriorReviewBundle): ExtractionResult {
  const seen = new Set<string>();
  const concerns: PriorConcern[] = [];
  const claimedRoots = new Set<string>();

  if (bundle.rubric_breakdown) {
    for (const cat of allRubricCategories(bundle.rubric_breakdown)) {
      extractFromRubricCategory(cat, bundle.review_id, seen, concerns, claimedRoots);
    }
  }

  for (const issue of bundle.editorial_issues) {
    if (issue.review_id && issue.review_id !== bundle.review_id) continue;
    extractFromEditorialIssue(issue, seen, concerns, claimedRoots);
  }

  for (const candidate of bundle.revision_candidates) {
    const issue = bundle.editorial_issues.find((i) => i.id === candidate.issue_id);
    if (issue?.review_id && issue.review_id !== bundle.review_id) continue;
    extractFromRevisionCandidate(candidate, issue ?? null, seen, concerns, claimedRoots);
  }

  let memoFallbackUsed = false;
  if (concerns.length === 0 && bundle.memo_content.trim()) {
    memoFallbackUsed = true;
    extractMemoFallback(bundle.memo_content, seen, concerns);
  }

  const structuredCount = concerns.filter((c) => c.source_type !== "memo_fallback").length;
  return { concerns, memo_fallback_used: memoFallbackUsed, structured_count: structuredCount };
}

function allRubricCategories(
  breakdown: NonNullable<PriorReviewBundle["rubric_breakdown"]>,
): RubricCategoryScore[] {
  return [...breakdown.craft_categories, ...breakdown.acquisition_categories];
}

function extractFromRubricCategory(
  cat: RubricCategoryScore,
  reviewId: string,
  seen: Set<string>,
  out: PriorConcern[],
  claimedRoots: Set<string>,
): void {
  if (!cat.deductions?.length) return;

  cat.deductions.forEach((deductionLabel, idx) => {
    const reason = cat.deduction_reasons?.[idx] ?? deductionLabel;
    const root = slugFromText(reason, cat.category_key);
    claimedRoots.add(normalizeRoot(reason));

    const examples = (cat.examples ?? [])
      .map((e) => e.text?.trim())
      .filter((t): t is string => Boolean(t));

    const id = dedupeId(`${cat.category_key}_${root}`, seen);
    out.push({
      concern_id: id,
      root_issue: reason,
      prior_criticism: reason,
      source_type: "rubric_deduction",
      source_location: `reviews.rubric_breakdown.${cat.category_key}.deductions[${idx}]`,
      was_scored: true,
      prior_deduction: cat.deduction / cat.deductions.length,
      rubric_category: cat.category_key,
      prior_evidence: examples,
      extraction_confidence: examples.length > 0 ? "high" : "medium",
    });
  });
}

function extractFromEditorialIssue(
  issue: EditorialIssueRecord,
  seen: Set<string>,
  out: PriorConcern[],
  claimedRoots: Set<string>,
): void {
  const root = issue.text.trim();
  if (!root) return;
  const norm = normalizeRoot(root);
  if (claimedRoots.has(norm)) return;
  claimedRoots.add(norm);

  const id = dedupeId(slugFromText(root, "issue"), seen);
  out.push({
    concern_id: id,
    root_issue: root,
    prior_criticism: root,
    source_type: "editorial_issue",
    source_location: `editorial_issues.${issue.id}`,
    was_scored: false,
    prior_deduction: 0,
    rubric_category: mapAreaToCategory(issue.area),
    prior_evidence: issue.success_criterion ? [issue.success_criterion] : [],
    extraction_confidence: "high",
  });
}

function extractFromRevisionCandidate(
  candidate: RevisionCandidateRecord,
  issue: EditorialIssueRecord | null,
  seen: Set<string>,
  out: PriorConcern[],
  claimedRoots: Set<string>,
): void {
  const criticism = (candidate.reason ?? issue?.text ?? candidate.original).trim();
  if (!criticism) return;
  const norm = normalizeRoot(criticism);
  if (claimedRoots.has(norm)) return;
  claimedRoots.add(norm);

  const evidence = [candidate.original.trim()].filter(Boolean);
  const id = dedupeId(slugFromText(criticism, "revision"), seen);
  out.push({
    concern_id: id,
    root_issue: criticism,
    prior_criticism: criticism,
    source_type: "revision_candidate",
    source_location: `revision_candidates.${candidate.id}`,
    was_scored: false,
    prior_deduction: 0,
    rubric_category: issue ? mapAreaToCategory(issue.area) : null,
    prior_evidence: evidence,
    extraction_confidence: evidence.length > 0 ? "high" : "medium",
  });
}

/** Memo fallback: only structured weakness sections — not every negative sentence. */
function extractMemoFallback(
  memo: string,
  seen: Set<string>,
  out: PriorConcern[],
): void {
  const section = extractWeaknessSection(memo);
  if (!section) return;

  const items = parseNumberedItems(section);
  for (const item of items) {
    const id = dedupeId(slugFromText(item, "memo"), seen);
    out.push({
      concern_id: id,
      root_issue: item,
      prior_criticism: item,
      source_type: "memo_fallback",
      source_location: "reviews.content.weaknesses",
      was_scored: false,
      prior_deduction: 0,
      rubric_category: null,
      prior_evidence: [],
      extraction_confidence: "low",
    });
  }
}

function extractWeaknessSection(memo: string): string | null {
  for (const pattern of MEMO_WEAKNESS_HEADINGS) {
    const match = memo.match(pattern);
    if (!match || match.index === undefined) continue;
    const start = match.index + match[0].length;
    const rest = memo.slice(start);
    const nextHeading = rest.search(/^##\s+/m);
    return (nextHeading >= 0 ? rest.slice(0, nextHeading) : rest).trim();
  }
  return null;
}

function parseNumberedItems(section: string): string[] {
  const lines = section.split("\n").map((l) => l.trim()).filter(Boolean);
  const items: string[] = [];
  let current = "";

  for (const line of lines) {
    const numbered = line.match(/^\d+[\.)]\s+(.+)/);
    const bulleted = line.match(/^[-*]\s+(.+)/);
    if (numbered || bulleted) {
      if (current) items.push(current.trim());
      current = (numbered?.[1] ?? bulleted?.[1] ?? line).trim();
    } else if (current) {
      current += ` ${line}`;
    }
  }
  if (current) items.push(current.trim());
  return items.filter((i) => i.length > 20);
}

function normalizeRoot(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function mapAreaToCategory(area: string | null): string | null {
  if (!area) return null;
  const key = area.toLowerCase().replace(/\s+/g, "_");
  if (key.includes("pacing")) return "pacing_narrative_tension";
  if (key.includes("character")) return "character_development_relationships";
  if (key.includes("plot")) return "plot_architecture_causality";
  if (key.includes("voice") || key.includes("prose")) return "voice_prose_execution";
  if (key.includes("genre")) return "genre_fulfillment_reader_expectations";
  return null;
}

/** Keywords for search-plan construction (exported for tests). */
export function extractKeywords(text: string, max = 8): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
  return [...new Set(words)].slice(0, max);
}
