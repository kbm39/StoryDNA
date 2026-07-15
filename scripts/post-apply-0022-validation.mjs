/**
 * Post-apply validation for migration 0022_contrary_evidence_gate.sql
 *   node --env-file=.env.local scripts/post-apply-0022-validation.mjs
 */
import pg from "pg";

const LEGACY_REVIEW_ID = "7822524d-20cb-403b-ab28-a320e0debd60";
const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL is not set.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

const results = { passed: 0, failed: 0, checks: [] };

function check(name, ok, detail = "") {
  results.checks.push({ name, ok, detail });
  if (ok) results.passed++;
  else results.failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

// A. review_concern_assessments exists
const tableRes = await client.query(`
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'review_concern_assessments'
  ) AS exists
`);
check("A. review_concern_assessments table exists", tableRes.rows[0].exists === true);

// B. Required columns on review_concern_assessments
const requiredAssessmentCols = [
  "id", "review_id", "prior_review_id", "manuscript_id", "manuscript_version_id",
  "prior_manuscript_version_id", "concern_id", "root_issue", "source_type",
  "rubric_category", "prior_criticism", "prior_evidence", "current_supporting_evidence",
  "current_contrary_evidence", "revision_change", "original_basis_still_present",
  "status", "confidence", "prior_deduction", "points_restored", "remaining_deduction",
  "narrowed_current_finding", "explanation", "created_at",
];
const colRes = await client.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'review_concern_assessments'
`);
const foundCols = new Set(colRes.rows.map((r) => r.column_name));
const missingCols = requiredAssessmentCols.filter((c) => !foundCols.has(c));
check(
  "B. review_concern_assessments has all required columns",
  missingCols.length === 0,
  missingCols.length ? `missing: ${missingCols.join(", ")}` : `${foundCols.size} columns`,
);

// C. reviews gate columns
const requiredReviewCols = [
  "contrary_evidence_gate_status", "contrary_evidence_gate_version", "scoring_gate_valid",
  "duplicate_deduction_count", "restored_points_total", "blocked_stale_deduction_count",
];
const reviewColRes = await client.query(`
  SELECT column_name, is_nullable FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'reviews'
    AND column_name = ANY($1)
`, [requiredReviewCols]);
const reviewCols = new Map(reviewColRes.rows.map((r) => [r.column_name, r.is_nullable]));
for (const c of requiredReviewCols) {
  check(
    `C. reviews.${c} exists and nullable`,
    reviewCols.has(c) && reviewCols.get(c) === "YES",
    reviewCols.get(c) ?? "missing",
  );
}

// D. RPC rejects bad gate states (transaction rollback)
async function expectRpcReject(label, gradingPatch) {
  const baseGrading = {
    grade_status: "VERIFIED",
    statistics_validation_status: "VERIFIED",
    arithmetic_validation_status: "VERIFIED",
    evidence_completeness_status: "COMPLETE",
    grading_formula_version: "STORYDNA_COMMERCIAL_FICTION_RUBRIC_V1",
    manuscript_score: 70,
    craft_score: 48,
    acquisition_readiness_score: 22,
    canonical_word_count: 111491,
    rubric_breakdown: { craft_categories: [{ category_key: "x" }], acquisition_categories: [] },
    ...gradingPatch,
  };
  await client.query("BEGIN");
  try {
    await client.query(
      `SELECT public.publish_commercial_review_generation($1, 'anthropic', 'test', 'content', '{}'::jsonb, '{}'::jsonb, $2::jsonb)`,
      ["9f482ca2-a0f6-4709-8364-18a0ef950eb0", JSON.stringify(baseGrading)],
    );
    await client.query("ROLLBACK");
    check(`D. RPC rejects ${label}`, false, "expected exception but succeeded");
  } catch (e) {
    await client.query("ROLLBACK");
    check(`D. RPC rejects ${label}`, true, e.message.split("\n")[0].slice(0, 80));
  }
}

await expectRpcReject("required_not_run", { contrary_evidence_gate_status: "required_not_run" });
await expectRpcReject("failed", { contrary_evidence_gate_status: "failed" });
await expectRpcReject("scoring_gate_valid=false when completed", {
  contrary_evidence_gate_status: "completed",
  scoring_gate_valid: false,
});

// E. Legacy review unchanged
const legacyRes = await client.query(`
  SELECT id, lifecycle_status, manuscript_score, craft_score, acquisition_readiness_score,
         manuscript_letter_grade, contrary_evidence_gate_status, scoring_gate_valid,
         duplicate_deduction_count, restored_points_total, blocked_stale_deduction_count
  FROM public.reviews WHERE id = $1
`, [LEGACY_REVIEW_ID]);
const legacy = legacyRes.rows[0];
check("E. Legacy review exists", !!legacy);
check("E. Legacy review active", legacy?.lifecycle_status === "active");
check("E. Legacy score 70", Number(legacy?.manuscript_score) === 70);
check("E. Legacy craft 48", Number(legacy?.craft_score) === 48);
check("E. Legacy acquisition 22", Number(legacy?.acquisition_readiness_score) === 22);
check("E. Legacy gate_status null", legacy?.contrary_evidence_gate_status == null);
check("E. Legacy scoring_gate_valid null", legacy?.scoring_gate_valid == null);

const assessCount = await client.query(
  `SELECT count(*)::int AS n FROM public.review_concern_assessments WHERE review_id = $1`,
  [LEGACY_REVIEW_ID],
);
check("E. No fabricated gate assessments", assessCount.rows[0].n === 0);

// Indexes
const idxRes = await client.query(`
  SELECT indexname FROM pg_indexes
  WHERE schemaname = 'public' AND tablename = 'review_concern_assessments'
`);
check(
  "Indexes on review_concern_assessments",
  idxRes.rows.length >= 2,
  idxRes.rows.map((r) => r.indexname).join(", "),
);

await client.end();
console.log(`\nValidation: ${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed === 0 ? 0 : 1);
