/**
 * Development-only replay: memo + gate assessments + raw rubric → normalization (zero AI, zero DB writes).
 *
 *   node --env-file=.env.local --experimental-strip-types scripts/replay-rubric-normalization.mjs
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootUrl = pathToFileURL(`${root}/`).href;

register(
  `data:text/javascript,${encodeURIComponent(`
import { statSync } from "node:fs";
import { pathToFileURL } from "node:url";
export function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export default {}", shortCircuit: true };
  if (specifier.startsWith("@/")) {
    const rel = specifier.slice(2);
    let base = new URL(rel, ${JSON.stringify(rootUrl)}).pathname;
    const candidates = [base + ".ts", base + "/index.ts"];
    for (const c of candidates) {
      try { statSync(c); return { url: pathToFileURL(c).href, shortCircuit: true }; } catch {}
    }
  }
  return nextResolve(specifier, context);
}
`)}`,
  import.meta.url,
);

process.env.CONTRARY_EVIDENCE_DETERMINISTIC = "1";

const MANUSCRIPT_ID = "9f482ca2-a0f6-4709-8364-18a0ef950eb0";
const LEGACY_REVIEW_ID = "7822524d-20cb-403b-ab28-a320e0debd60";

const {
  createDeterministicSemanticAssessor,
  runContraryEvidenceGate,
  buildGenreProfile,
  normalizeRubricAgainstGate,
  validatePostScoringRubric,
  enforceScoringGate,
} = await import("../lib/contrary-evidence/index.ts");
const { makeStackedAuditRubric } = await import("../lib/contrary-evidence/fixtures/stacked-audit.ts");

const url = process.env.SUPABASE_DB_URL;
let rawRubric = null;
let priorBundle = null;
let memoContent = "";
let priorText = "";
let currentText = "";

if (url) {
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const reviewRes = await client.query(
    `SELECT rubric_breakdown, content, manuscript_version_id FROM reviews WHERE id = $1`,
    [LEGACY_REVIEW_ID],
  );
  rawRubric = reviewRes.rows[0]?.rubric_breakdown ?? null;
  memoContent = reviewRes.rows[0]?.content ?? "";

  const msRes = await client.query(
    `SELECT mv.extracted_text FROM manuscripts m JOIN manuscript_versions mv ON mv.id = m.current_version_id WHERE m.id = $1`,
    [MANUSCRIPT_ID],
  );
  currentText = msRes.rows[0]?.extracted_text?.trim() ?? "";
  priorText = currentText;

  const issuesRes = await client.query(
    `SELECT id, review_id, text, area, severity, source_section, success_criterion FROM editorial_issues WHERE manuscript_id = $1 AND review_id = $2`,
    [MANUSCRIPT_ID, LEGACY_REVIEW_ID],
  );
  priorBundle = {
    review_id: LEGACY_REVIEW_ID,
    manuscript_version_id: reviewRes.rows[0].manuscript_version_id,
    rubric_breakdown: rawRubric,
    memo_content: reviewRes.rows[0].content,
    editorial_issues: issuesRes.rows,
    revision_candidates: [],
  };

  await client.end();
}

if (!rawRubric) {
  console.warn("[replay] DB unavailable or rubric missing — using stacked-audit fixture.");
  rawRubric = makeStackedAuditRubric();
  priorBundle = {
    review_id: "fixture",
    manuscript_version_id: "v1",
    rubric_breakdown: rawRubric,
    memo_content: "",
    editorial_issues: [],
    revision_candidates: [],
  };
  priorText = "fixture text for gate";
  currentText = priorText;
}

const genre = buildGenreProfile(null);
const gateResult = await runContraryEvidenceGate({
  priorReview: priorBundle,
  priorText,
  currentText,
  genre,
  semanticAssessor: createDeterministicSemanticAssessor(),
  comparison_mode: "SAME_VERSION_REASSESSMENT",
});

const normalization = normalizeRubricAgainstGate({
  rawPayload: rawRubric,
  gateAssessments: gateResult.assessments,
  comparison_mode: gateResult.comparison_mode,
  canonicalWordCount: 111491,
  fullTextSupplied: true,
  memoContent,
});

const postScoring = validatePostScoringRubric({
  payload: rawRubric,
  preGateAssessments: gateResult.assessments,
  preScoringGate: enforceScoringGate({
    assessments: gateResult.assessments,
    comparison_mode: gateResult.comparison_mode,
  }),
  gateRequired: true,
  gateRan: true,
  priorReviewId: LEGACY_REVIEW_ID,
  comparison_mode: gateResult.comparison_mode,
  canonicalWordCount: 111491,
  fullTextSupplied: true,
  normalizationResult: normalization,
});

const byDisposition = {};
for (const d of normalization.dispositions) {
  byDisposition[d.disposition] = (byDisposition[d.disposition] ?? 0) + 1;
}

const report = {
  source: url ? `legacy review ${LEGACY_REVIEW_ID}` : "stacked-audit fixture",
  comparison_mode: gateResult.comparison_mode,
  raw_score: normalization.rawModelScore,
  invalid_deductions_removed: normalization.dispositions.reduce((s, d) => s + d.points_removed, 0),
  mechanically_recoverable_points: normalization.adjustmentsSummary.mechanically_recoverable_points,
  evidence_ceiling_reductions: normalization.adjustmentsSummary.evidence_ceiling_reductions,
  valid_deductions_retained: normalization.adjustmentsSummary.valid_deductions_retained_points,
  normalized_craft_score: normalization.craftScore,
  normalized_acquisition_score: normalization.acquisitionScore,
  normalized_total: normalization.normalizedApplicationScore,
  normalized_grade: normalization.letterGrade,
  recommendation: normalization.recommendationConsistency.recommendation,
  recommendation_consistent: normalization.recommendationConsistency.recommendation_consistent,
  recommendation_errors: normalization.recommendationConsistency.errors,
  category_audits: normalization.categoryAudits.map((a) => ({
    category_key: a.category_key,
    maximum_points: a.maximum_points,
    raw_awarded: a.raw_awarded_points,
    invalid_removed: a.invalid_deductions_removed,
    valid_retained: a.valid_deductions_retained,
    evidence_strength: a.positive_evidence_strength,
    evidence_ceiling: a.positive_evidence_ceiling,
    ceiling_reduction: a.ceiling_reduction_applied,
    normalized_awarded: a.normalized_awarded_points,
    increased_without_evidence: a.increased_without_positive_evidence,
    ceiling_reason: a.ceiling_reason,
  })),
  deductions_removed_by_disposition: byDisposition,
  duplicate_points_removed: normalization.dispositions.reduce((s, d) => s + d.points_removed, 0),
  root_issue_cap_reductions: normalization.rootIssueCapAdjustments,
  adjustments_summary: normalization.adjustmentsSummary,
  publication_validation_passes: postScoring.valid,
  validation_errors: postScoring.errors.slice(0, 15),
  ai_calls: 0,
  db_writes: 0,
};

console.log(JSON.stringify(report, null, 2));
process.exit(postScoring.valid ? 0 : 1);
