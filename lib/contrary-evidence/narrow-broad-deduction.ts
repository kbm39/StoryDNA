/**
 * Deterministic narrowing for broad rubric deductions before post-scoring validation.
 * Uses structured category evidence — never invokes a model.
 */
import type { RubricCategoryScore } from "../commercial-fiction-rubric.ts";
import type { RubricDeductionEntry } from "./duplicate-deductions.ts";
import { isBroadCriticism } from "./scoring-gate.ts";
import type { ConcernAssessment } from "./types.ts";

export interface NarrowBroadDeductionInput {
  entry: RubricDeductionEntry;
  category: RubricCategoryScore;
  assessment: ConcernAssessment | null;
}

/** Dispositions that require deterministic narrowing when deduction_reason is broad. */
export const BROAD_NARROW_DISPOSITIONS = new Set([
  "RETAINED_AS_NEW_CONCERN",
  "REDUCED_TO_GATE_MAX",
]);

function cleanSnippet(text: string, maxLen: number): string {
  return text.replace(/\s+/g, " ").trim().slice(0, maxLen);
}

function formatLocation(location: string | null | undefined, fallback: string): string {
  const loc = location?.trim();
  return loc && loc.length > 0 ? loc : fallback;
}

function collectExampleSnippets(
  category: RubricCategoryScore,
  entry: RubricDeductionEntry,
  assessment: ConcernAssessment | null,
): Array<{ text: string; location: string }> {
  const seen = new Set<string>();
  const out: Array<{ text: string; location: string }> = [];

  const push = (text: string | undefined, location: string | null | undefined) => {
    const cleaned = text?.trim();
    if (!cleaned || cleaned.length < 12) return;
    const key = cleaned.slice(0, 80).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      text: cleaned,
      location: formatLocation(location, "manuscript"),
    });
  };

  for (const example of category.examples ?? []) {
    push(example.text, example.location);
  }
  for (const text of entry.example_texts) {
    push(text, null);
  }
  for (const snippet of assessment?.current_supporting_evidence ?? []) {
    if (snippet.relevance === "supporting") {
      push(snippet.text, snippet.location ?? null);
    }
  }

  return out;
}

function hasSufficientEvidence(category: RubricCategoryScore, snippets: Array<{ text: string }>): boolean {
  if (category.insufficient_evidence) return snippets.length >= 1;
  return snippets.length >= 2;
}

/**
 * Build a passage-specific deduction reason from structured rubric evidence.
 * Returns null when narrowing cannot be done safely (fail closed upstream).
 */
export function buildDeterministicNarrowedDeduction(input: NarrowBroadDeductionInput): string | null {
  const { entry, category, assessment } = input;

  const gateFinding = assessment?.narrowed_current_finding?.trim();
  if (gateFinding && !isBroadCriticism(gateFinding)) {
    return gateFinding;
  }

  const revision = (category.revision_to_recover ?? "").trim();
  if (!revision) return null;

  const snippets = collectExampleSnippets(category, entry, assessment);
  if (!hasSufficientEvidence(category, snippets)) return null;

  const primary = snippets[0];
  const secondary = snippets[1] ?? snippets[0];
  const issueLabel = cleanSnippet(entry.deduction_label || category.category_name, 72);
  const revisionLead = cleanSnippet(revision, 100);

  const narrowed = [
    `Specific ${issueLabel} issue at ${primary.location}`,
    `(evidence: "${cleanSnippet(primary.text, 90)}")`,
    secondary !== primary
      ? `and ${secondary.location} ("${cleanSnippet(secondary.text, 70)}")`
      : "",
    `— revision path: ${revisionLead}.`,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!narrowed || isBroadCriticism(narrowed)) return null;
  return narrowed;
}

export function shouldDeterministicallyNarrowDeduction(
  deductionReason: string,
  disposition: string,
  normalizedPoints: number,
): boolean {
  if (normalizedPoints <= 0.01) return false;
  if (!BROAD_NARROW_DISPOSITIONS.has(disposition)) return false;
  return isBroadCriticism(deductionReason);
}
