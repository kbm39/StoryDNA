import type { ConcernAssessment, ComparisonMode, EvidenceSnippet } from "./types.ts";
import {
  gateStatusDeductionContract,
  sameVersionStatusDeductionContract,
} from "./post-scoring-contracts.ts";
import {
  CONTRARY_EVIDENCE_GATE_VERSION,
  DEFAULT_ROOT_ISSUE_CATEGORY_CAP,
  DEFAULT_ROOT_ISSUE_DEDUCTION_CAP,
  GATE_PROMPT_MAX_CHARS,
} from "./constants.ts";
import { normalizeRootIssueKey, rootIssueLabel } from "./normalize-root-issue.ts";
import { statusZeroesDeduction } from "./scoring-gate.ts";

export interface CompactGatePromptResult {
  block: string;
  charCount: number;
  concernCount: number;
  summarized: boolean;
  representedConcernIds: string[];
}

/** Approximate chars consumed by the fixed gate prompt wrapper (header, rules, footer). */
const WRAPPER_OVERHEAD_CHARS = 560;

/** Use summarized layout when concern count exceeds this threshold. */
const SUMMARIZE_CONCERN_THRESHOLD = 20;

/** Build compact Call B prompt block from pre-scoring gate assessments. */
export function buildContraryEvidenceGatePromptBlock(
  assessments: ConcernAssessment[],
  options?: { maxChars?: number },
): CompactGatePromptResult {
  if (assessments.length === 0) {
    return { block: "", charCount: 0, concernCount: 0, summarized: false, representedConcernIds: [] };
  }

  const maxChars = options?.maxChars ?? GATE_PROMPT_MAX_CHARS;
  const bodyBudget = Math.max(500, maxChars - WRAPPER_OVERHEAD_CHARS);
  const mode = assessments[0]?.comparison_mode ?? "REVISION_COMPARISON";
  const representedConcernIds = assessments.map((a) => a.concern_id);

  const prohibited = assessments.filter((a) => statusZeroesDeduction(a.status, mode));
  const retained = assessments.filter((a) => !statusZeroesDeduction(a.status, mode) && a.remaining_deduction > 0);
  const rootCaps = buildRootIssueCaps(assessments);

  let summarized =
    assessments.length > SUMMARIZE_CONCERN_THRESHOLD || prohibited.length > SUMMARIZE_CONCERN_THRESHOLD;
  let body = summarized
    ? buildSummarizedBody(mode, prohibited, retained, rootCaps, assessments, bodyBudget)
    : buildFullBody(mode, prohibited, retained, rootCaps, assessments);

  if (!summarized && body.length > bodyBudget) {
    summarized = true;
    body = buildSummarizedBody(mode, prohibited, retained, rootCaps, assessments, bodyBudget);
  }

  let block = assembleBlock(mode, body);

  if (block.length > maxChars) {
    summarized = true;
    const tighterBudget = Math.max(400, bodyBudget - (block.length - maxChars) - 50);
    body = buildSummarizedBody(mode, prohibited, retained, rootCaps, assessments, tighterBudget);
    block = assembleBlock(mode, body);
  }

  if (block.length > maxChars) {
    body = buildMinimalBody(mode, prohibited, retained, rootCaps, assessments, bodyBudget);
    block = assembleBlock(mode, body);
  }

  return {
    block,
    charCount: block.length,
    concernCount: assessments.length,
    summarized,
    representedConcernIds,
  };
}

function assembleBlock(mode: ComparisonMode, body: string): string {
  return `

═══════════════════════════════════════════════════════════════
UNIVERSAL CONTRARY-EVIDENCE GATE (${CONTRARY_EVIDENCE_GATE_VERSION})
Mode: ${mode}
═══════════════════════════════════════════════════════════════
${mode === "SAME_VERSION_REASSESSMENT" ? "Same manuscript version — do NOT claim revision improvement or restored-by-revision points.\n" : "Prior manuscript revision detected — honor revision-aware assessments.\n"}
Rules:
- Do NOT stack the same root issue across multiple categories as independent full deductions.
- Each retained deduction MUST cite current manuscript evidence (2 examples) and revision_to_recover.
- Prohibited deductions MUST be zero in the rubric.

${body}
═══════════════════════════════════════════════════════════════`;
}

function buildFullBody(
  mode: ComparisonMode,
  prohibited: ConcernAssessment[],
  retained: ConcernAssessment[],
  rootCaps: string,
  all: ConcernAssessment[],
): string {
  const prohibitedLines = groupProhibitedCompact(prohibited, mode);
  const retainedLines = retained.map((a) => formatRetainedLine(a, mode)).join("\n");
  const modeRules =
    mode === "SAME_VERSION_REASSESSMENT"
      ? `Same-version statuses: SUPPORTED (may retain with evidence), UNSUPPORTED (must be 0), OVERBROAD (narrow + cap), DUPLICATED (0), NOT_ASSESSABLE (0).`
      : `Revision statuses: RESOLVED/STALE=0; SUBSTANTIALLY/PARTIALLY_IMPROVED restore points; UNCHANGED needs fresh evidence.`;

  return `${modeRules}

ROOT ISSUE CAPS (max ${DEFAULT_ROOT_ISSUE_DEDUCTION_CAP} pts, ${DEFAULT_ROOT_ISSUE_CATEGORY_CAP} categories):
${rootCaps}

PROHIBITED DEDUCTIONS (${prohibited.length} concerns — must deduct 0):
${prohibitedLines || "(none)"}

RETAINED / NARROWED CONCERNS (${retained.length}):
${retainedLines || "(none — apply root caps only)"}

CONCERN IDS (${all.length}): ${formatConcernIdList(all.map((a) => a.concern_id))}`;
}

function buildSummarizedBody(
  mode: ComparisonMode,
  prohibited: ConcernAssessment[],
  retained: ConcernAssessment[],
  rootCaps: string,
  all: ConcernAssessment[],
  bodyBudget: number,
): string {
  const byRoot = groupByRoot(all);
  const lines: string[] = [];

  lines.push(
    mode === "SAME_VERSION_REASSESSMENT"
      ? "Same-version summary — no revision-restored points."
      : "Revision-comparison summary.",
  );
  lines.push(`SUMMARY (${all.length} concerns by root issue):`);

  for (const [rootKey, group] of byRoot) {
    const label = rootIssueLabel(rootKey);
    const statuses = group.map((a) => `${a.concern_id}:${a.status}`).join(", ");
    const maxAllowed = Math.max(...group.map((a) => a.remaining_deduction));
    lines.push(
      `- ${label} (${group.length}, max ${maxAllowed.toFixed(2)}): ${statuses.slice(0, 200)}${statuses.length > 200 ? "…" : ""}`,
    );
  }

  lines.push("");
  lines.push(`PROHIBITED (${prohibited.length}): ${groupProhibitedCompact(prohibited, mode)}`);
  if (retained.length > 0) {
    lines.push(`RETAINED (${retained.length}): ${retained.map((a) => formatRetainedLine(a, mode)).join(" | ")}`);
  }
  lines.push(`ROOT CAPS:\n${rootCaps}`);
  lines.push(`CONCERN IDS (${all.length}): ${formatConcernIdList(all.map((a) => a.concern_id))}`);

  let text = lines.join("\n");
  if (text.length > bodyBudget) {
    text = shrinkSummarizedBody(text, all, bodyBudget);
  }
  return text;
}

function buildMinimalBody(
  mode: ComparisonMode,
  prohibited: ConcernAssessment[],
  retained: ConcernAssessment[],
  rootCaps: string,
  all: ConcernAssessment[],
  bodyBudget: number,
): string {
  const prohibitedLine = `PROHIBITED (${prohibited.length}): ${prohibited.map((a) => `${a.concern_id}:${a.status}`).join(", ")}`;
  const retainedLine =
    retained.length > 0
      ? `RETAINED: ${retained.map((a) => `${a.concern_id}(max ${a.remaining_deduction.toFixed(2)})`).join(", ")}`
      : "RETAINED: (none)";

  const head = [
    mode === "SAME_VERSION_REASSESSMENT" ? "Same-version compact gate." : "Revision compact gate.",
    prohibitedLine,
    retainedLine,
    `ROOT CAPS: ${rootCaps.replace(/\n/g, " ")}`,
  ].join("\n");

  const roomForIds = Math.max(200, bodyBudget - head.length - 2);
  let ids = formatConcernIdList(all.map((a) => a.concern_id));
  if (ids.length > roomForIds) {
    ids = ids.slice(0, roomForIds - 20) + " … [ids continue]";
  }
  return `${head}\nCONCERN IDS (${all.length}): ${ids}`;
}

function shrinkSummarizedBody(text: string, all: ConcernAssessment[], bodyBudget: number): string {
  const ids = all.map((a) => a.concern_id);
  const idSuffix = `\nCONCERN IDS (${ids.length}): ${formatConcernIdList(ids)}`;
  const room = Math.max(300, bodyBudget - idSuffix.length - 40);
  const trimmed = text.slice(0, room) + "\n… [root groups truncated; all concern ids listed below]";
  return trimmed + idSuffix;
}

function formatConcernIdList(ids: string[]): string {
  return ids.join(", ");
}

function groupProhibitedCompact(prohibited: ConcernAssessment[], mode: ComparisonMode): string {
  const byRoot = new Map<string, ConcernAssessment[]>();
  for (const a of prohibited) {
    const key = normalizeRootIssueKey(a.root_issue);
    const list = byRoot.get(key) ?? [];
    list.push(a);
    byRoot.set(key, list);
  }

  const lines: string[] = [];
  for (const [rootKey, group] of byRoot) {
    const ids = group.map((a) => a.concern_id).join(", ");
    const contract =
      mode === "SAME_VERSION_REASSESSMENT"
        ? sameVersionStatusDeductionContract(group[0].status as import("./types.ts").SameVersionStatus)
        : gateStatusDeductionContract(group[0].status as import("./types.ts").ConcernStatus, group[0].prior_deduction);
    lines.push(`- [${rootIssueLabel(rootKey)}] ${ids} → ${contract}`);
  }
  return lines.join("\n");
}

function formatRetainedLine(a: ConcernAssessment, mode: ComparisonMode): string {
  const support = compactEvidenceRef(a.current_supporting_evidence, "supporting");
  const contrary = compactEvidenceRef(a.current_contrary_evidence, "contrary");
  const contract =
    mode === "SAME_VERSION_REASSESSMENT"
      ? sameVersionStatusDeductionContract(a.status as import("./types.ts").SameVersionStatus)
      : gateStatusDeductionContract(a.status as import("./types.ts").ConcernStatus, a.prior_deduction);
  const narrowed = a.narrowed_current_finding ? ` | narrowed: ${a.narrowed_current_finding.slice(0, 80)}` : "";
  return `- ${a.concern_id} | ${normalizeRootIssueKey(a.root_issue)} | ${a.status} | max ${a.remaining_deduction.toFixed(2)} | ${contract} | support: [${support.location}] ${support.excerpt} | contrary: [${contrary.location}] ${contrary.excerpt}${narrowed}`;
}

function buildRootIssueCaps(assessments: ConcernAssessment[]): string {
  const byRoot = groupByRoot(assessments);
  const lines: string[] = [];
  for (const [rootKey, group] of byRoot) {
    if (rootKey === "unknown" || group.length <= 1) continue;
    const categories = new Set(group.map((g) => g.rubric_category).filter(Boolean));
    lines.push(
      `- ${rootIssueLabel(rootKey)}: max ${DEFAULT_ROOT_ISSUE_DEDUCTION_CAP} total pts, max ${DEFAULT_ROOT_ISSUE_CATEGORY_CAP} categories (currently ${categories.size} categories, ${group.length} concerns)`,
    );
  }
  return lines.length > 0 ? lines.join("\n") : "(no duplicate root issues detected)";
}

function groupByRoot(assessments: ConcernAssessment[]): Map<string, ConcernAssessment[]> {
  const byRoot = new Map<string, ConcernAssessment[]>();
  for (const a of assessments) {
    const key = normalizeRootIssueKey(a.root_issue);
    const list = byRoot.get(key) ?? [];
    list.push(a);
    byRoot.set(key, list);
  }
  return byRoot;
}

function compactEvidenceRef(
  snippets: EvidenceSnippet[],
  prefer: EvidenceSnippet["relevance"],
): { location: string; excerpt: string } {
  const s = snippets.find((x) => x.relevance === prefer) ?? snippets[0];
  if (!s) return { location: "n/a", excerpt: "none" };
  return {
    location: s.location ?? "n/a",
    excerpt: s.text.slice(0, 80).replace(/\s+/g, " ").trim(),
  };
}
