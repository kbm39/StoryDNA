/**
 * Phase 2 deterministic gate dry run — no AI, no publish, no DB writes.
 *
 *   CONTRARY_EVIDENCE_DETERMINISTIC=1 node --env-file=.env.local \
 *     --experimental-strip-types scripts/phase2-deterministic-dry-run.mjs
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
export function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: "data:text/javascript,export default {}", shortCircuit: true };
  }
  if (specifier === "next/cache") {
    return {
      url: "data:text/javascript,export function revalidatePath() {}",
      shortCircuit: true,
    };
  }
  if (specifier.startsWith("@/")) {
    const rel = specifier.slice(2);
    let url = new URL(rel, ${JSON.stringify(rootUrl)}).href;
    if (!url.endsWith(".ts") && !url.endsWith(".tsx") && !url.endsWith(".js")) {
      url += ".ts";
    }
    return { url, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
`)}`,
  import.meta.url,
);

process.env.CONTRARY_EVIDENCE_DETERMINISTIC = "1";

const MANUSCRIPT_ID = "9f482ca2-a0f6-4709-8364-18a0ef950eb0";
const ACTIVE_REVIEW_ID = "7822524d-20cb-403b-ab28-a320e0debd60";

const {
  buildGenreProfile,
  buildContraryEvidenceGatePromptBlock,
  createDeterministicSemanticAssessor,
  runContraryEvidenceGate,
  selectPriorReviewCandidate,
  validatePostScoringRubric,
} = await import("../lib/contrary-evidence/index.ts");
const { validateCommercialRubric } = await import("../lib/rubric-validation.ts");
const { analyzeDuplicateDeductions } = await import(
  "../lib/contrary-evidence/duplicate-deductions.ts"
);
const { CONTRARY_EVIDENCE_GATE_VERSION, GATE_PROMPT_MAX_CHARS } = await import(
  "../lib/contrary-evidence/constants.ts"
);

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL is not set.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

const beforeSnap = await client.query(`
  SELECT
    (SELECT count(*)::int FROM public.reviews WHERE manuscript_id = $1) AS review_count,
    (SELECT count(*)::int FROM public.review_concern_assessments rca
     JOIN public.reviews r ON r.id = rca.review_id
     WHERE r.manuscript_id = $1) AS assessment_count,
    (SELECT lifecycle_status FROM public.reviews WHERE id = $2) AS active_status,
    (SELECT manuscript_score FROM public.reviews WHERE id = $2) AS active_score
`, [MANUSCRIPT_ID, ACTIVE_REVIEW_ID]);

const msRes = await client.query(`
  SELECT m.id, m.current_version_id, mv.extracted_text, mv.content_hash, mv.word_count
  FROM public.manuscripts m
  LEFT JOIN public.manuscript_versions mv ON mv.id = m.current_version_id
  WHERE m.id = $1
`, [MANUSCRIPT_ID]);
const ms = msRes.rows[0];
const currentText = ms.extracted_text?.trim() ?? "";
const currentVersionId = ms.current_version_id;
const currentContentHash = ms.content_hash ?? null;

const reviewsRes = await client.query(`
  SELECT r.id, r.created_at, r.content, r.rubric_breakdown, r.manuscript_version_id,
         r.manuscript_score, r.lifecycle_status,
         mv.content_hash, mv.word_count, mv.created_at AS version_created_at
  FROM public.reviews r
  LEFT JOIN public.manuscript_versions mv ON mv.id = r.manuscript_version_id
  WHERE r.manuscript_id = $1 AND r.perspective = 'commercial'
    AND r.lifecycle_status IN ('active', 'superseded')
  ORDER BY r.created_at DESC
`, [MANUSCRIPT_ID]);

const candidates = reviewsRes.rows.map((r) => ({
  review_id: r.id,
  created_at: r.created_at,
  manuscript_version_id: r.manuscript_version_id,
  version_created_at: r.version_created_at,
  content_hash: r.content_hash,
  word_count: r.word_count != null ? Number(r.word_count) : null,
  lifecycle_status: r.lifecycle_status,
  manuscript_score: r.manuscript_score != null ? Number(r.manuscript_score) : null,
}));

const selection = selectPriorReviewCandidate(candidates, currentVersionId);
const selected = selection.selected;

const priorReviewRow = selected
  ? reviewsRes.rows.find((r) => r.id === selected.review_id)
  : null;

let priorText = "";
if (selected?.manuscript_version_id) {
  const priorTextRes = await client.query(
    `SELECT extracted_text, content_hash FROM public.manuscript_versions WHERE id = $1`,
    [selected.manuscript_version_id],
  );
  priorText = priorTextRes.rows[0]?.extracted_text?.trim() ?? "";
}

const issuesRes = priorReviewRow
  ? await client.query(`
      SELECT id, review_id, text, area, severity, source_section, success_criterion
      FROM public.editorial_issues WHERE manuscript_id = $1 AND review_id = $2
    `, [MANUSCRIPT_ID, priorReviewRow.id])
  : { rows: [] };

const candidatesRes = await client.query(`
  SELECT id, issue_id, original, revised, reason, locator
  FROM public.revision_candidates WHERE manuscript_id = $1
`, [MANUSCRIPT_ID]);

const priorBundle = priorReviewRow
  ? {
      review_id: priorReviewRow.id,
      manuscript_version_id: priorReviewRow.manuscript_version_id,
      rubric_breakdown: priorReviewRow.rubric_breakdown,
      memo_content: priorReviewRow.content,
      editorial_issues: issuesRes.rows,
      revision_candidates: candidatesRes.rows,
    }
  : null;

const gateRequired = !!(priorBundle && selected?.manuscript_version_id && priorText);
const genre = buildGenreProfile(null);

let gateRan = false;
let gateResult = null;
let assessments = [];
let gatePromptResult = { block: "", charCount: 0 };

if (gateRequired) {
  gateResult = await runContraryEvidenceGate({
    priorReview: priorBundle,
    priorText,
    currentText,
    genre,
    semanticAssessor: createDeterministicSemanticAssessor(),
    comparison_mode: selection.comparison_mode,
    prior_version_id: selected.manuscript_version_id,
    current_version_id: currentVersionId,
    prior_content_hash: selected.content_hash,
    current_content_hash: currentContentHash,
  });
  gateRan = true;
  assessments = gateResult.assessments;
  gatePromptResult = buildContraryEvidenceGatePromptBlock(assessments);
}

const simulatedRubric = priorReviewRow?.rubric_breakdown ?? null;
const rawScore =
  simulatedRubric && typeof simulatedRubric === "object"
    ? [...(simulatedRubric.craft_categories ?? []), ...(simulatedRubric.acquisition_categories ?? [])].reduce(
        (s, c) => s + (Number(c.points_earned) || 0),
        0,
      )
    : null;

const dupBefore = simulatedRubric ? analyzeDuplicateDeductions(simulatedRubric) : { points_to_remove: [] };
const rubricDuplicatePointsRemoved = dupBefore.points_to_remove.reduce((s, r) => s + r.points, 0);

const postScoring = validatePostScoringRubric({
  payload: simulatedRubric,
  preGateAssessments: assessments,
  preScoringGate: gateResult?.scoring_gate ?? {
    valid: true,
    errors: [],
    assessments: [],
    adjusted_deductions: [],
    total_points_restored: 0,
  },
  gateRequired,
  gateRan,
  priorReviewId: selected?.review_id ?? null,
  comparison_mode: gateResult?.comparison_mode ?? selection.comparison_mode,
  canonicalWordCount: Number(ms.word_count) || 111491,
  fullTextSupplied: true,
});

const adjustedGrading = validateCommercialRubric({
  payload: postScoring.adjustedPayload,
  parseError: null,
  categoryKeyErrors: [],
  canonicalWordCount: Number(ms.word_count) || 111491,
  fullTextSupplied: true,
  statisticsValid: true,
});

const publishWouldAllow =
  postScoring.valid &&
  adjustedGrading.valid &&
  postScoring.scoringGateValid !== false &&
  gateRan &&
  (gateResult?.scoring_gate.valid ?? false);

const statusCounts = {};
for (const a of assessments) {
  statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1;
}

const afterSnap = await client.query(`
  SELECT
    (SELECT count(*)::int FROM public.reviews WHERE manuscript_id = $1) AS review_count,
    (SELECT count(*)::int FROM public.review_concern_assessments rca
     JOIN public.reviews r ON r.id = rca.review_id
     WHERE r.manuscript_id = $1) AS assessment_count,
    (SELECT lifecycle_status FROM public.reviews WHERE id = $2) AS active_status,
    (SELECT manuscript_score FROM public.reviews WHERE id = $2) AS active_score
`, [MANUSCRIPT_ID, ACTIVE_REVIEW_ID]);

await client.end();

const dbWrites =
  beforeSnap.rows[0].review_count !== afterSnap.rows[0].review_count ||
  beforeSnap.rows[0].assessment_count !== afterSnap.rows[0].assessment_count ||
  beforeSnap.rows[0].active_status !== afterSnap.rows[0].active_status ||
  Number(beforeSnap.rows[0].active_score) !== Number(afterSnap.rows[0].active_score);

const gatePointsInvalidated = assessments.reduce((s, a) => s + a.points_invalidated, 0);
const gateDuplicateRemoved = assessments.reduce((s, a) => s + a.duplicate_points_removed, 0);
const gateOverbreadthRemoved = assessments.reduce((s, a) => s + a.overbreadth_points_removed, 0);

const report = {
  comparison_mode: gateResult?.comparison_mode ?? selection.comparison_mode,
  selected_prior_review_id: selected?.review_id ?? null,
  selected_prior_manuscript_version_id: selected?.manuscript_version_id ?? null,
  current_manuscript_version_id: currentVersionId,
  hashes_differ:
    selected?.content_hash && currentContentHash
      ? selected.content_hash !== currentContentHash
      : selected?.manuscript_version_id !== currentVersionId,
  candidate_audit: selection.candidate_audit.map((c) => ({
    review_id: c.review_id,
    created_at: c.created_at,
    manuscript_version_id: c.manuscript_version_id,
    version_created_at: c.version_created_at,
    content_hash: c.content_hash,
    word_count: c.word_count,
    lifecycle_status: c.lifecycle_status,
  })),
  same_version_grading_review_id: selection.same_version_grading_review_id,
  prior_concerns_extracted: gateResult?.extraction.concerns.length ?? 0,
  status_counts: statusCounts,
  points_restored_by_revision:
    gateResult?.comparison_mode === "REVISION_COMPARISON" ? postScoring.restoredPointsTotal : 0,
  points_invalidated: gatePointsInvalidated,
  duplicate_points_removed: gateDuplicateRemoved + rubricDuplicatePointsRemoved,
  overbreadth_points_removed: gateOverbreadthRemoved,
  resolved_deductions_blocked: postScoring.resolvedDeductionsBlocked,
  stale_critiques_blocked: postScoring.staleCritiquesBlocked,
  unsupported_deductions_blocked: postScoring.unsupportedDeductionsBlocked,
  duplicate_deductions_removed: postScoring.duplicateDeductionsRemoved,
  overbroad_deductions_narrowed: postScoring.overbroadDeductionsNarrowed,
  raw_simulated_score: rawScore,
  adjusted_score: postScoring.manuscriptScore,
  adjusted_grade: postScoring.letterGrade,
  pre_scoring_gate_valid: gateResult?.scoring_gate.valid ?? null,
  post_scoring_gate_valid: postScoring.scoringGateValid,
  publish_would_be_allowed: publishWouldAllow,
  publish_block_reasons: postScoring.errors.slice(0, 10),
  gate_prompt_block_chars: gatePromptResult.charCount,
  gate_prompt_max_chars: GATE_PROMPT_MAX_CHARS,
  gate_prompt_within_budget: gatePromptResult.charCount <= GATE_PROMPT_MAX_CHARS,
  gate_prompt_summarized: gatePromptResult.summarized ?? false,
  database_writes_performed: dbWrites,
  legacy_review_unchanged: {
    before: beforeSnap.rows[0],
    after: afterSnap.rows[0],
  },
  contrary_evidence_gate_version: CONTRARY_EVIDENCE_GATE_VERSION,
  ai_calls: 0,
  rpc_called: false,
};

console.log(JSON.stringify(report, null, 2));
process.exit(dbWrites ? 1 : 0);
