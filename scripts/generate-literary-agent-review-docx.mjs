/**
 * Generate authoritative Literary Agent review DOCX locally (no AI).
 *
 *   node --env-file=.env.local --experimental-strip-types scripts/generate-literary-agent-review-docx.mjs [manuscriptId] [reviewId]
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootUrl = pathToFileURL(`${root}/`).href;

register(
  `data:text/javascript,${encodeURIComponent(`
import { statSync } from "node:fs";
import { pathToFileURL } from "node:url";
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
    let base = new URL(rel, ${JSON.stringify(rootUrl)}).pathname;
    if (base.endsWith(".ts") || base.endsWith(".tsx")) {
      try { statSync(base); return { url: pathToFileURL(base).href, shortCircuit: true }; } catch {}
    }
    for (const c of [base + ".ts", base + ".tsx", base + "/index.ts"]) {
      try { statSync(c); return { url: pathToFileURL(c).href, shortCircuit: true }; } catch {}
    }
  }
  return nextResolve(specifier, context);
}
`)}`,
  import.meta.url,
);

const manuscriptId = process.argv[2] ?? "9f482ca2-a0f6-4709-8364-18a0ef950eb0";
const reviewId = process.argv[3] ?? "04c525db-5091-4179-8086-8242b7c7f169";

const { resolveAuthoritativeReviewForDisplay } = await import(
  "../lib/authoritative-review-resolve.ts"
);
const { buildAuthoritativeReviewDisplay, validateAuthoritativeExport } = await import(
  "../lib/authoritative-review-display.ts"
);
const { buildLiteraryAgentReviewDocx, buildLiteraryAgentReviewDocxText } = await import(
  "../lib/literary-agent-docx.ts"
);
const { listConcernAssessmentsForReview } = await import("../lib/concern-assessments.ts");

const resolved = await resolveAuthoritativeReviewForDisplay(manuscriptId, "commercial", reviewId);
const assessments = await listConcernAssessmentsForReview(reviewId);
const display = buildAuthoritativeReviewDisplay({
  review: resolved.review,
  manuscriptTitle: resolved.manuscriptTitle,
  assessments,
  fallbackWordCount: resolved.fallbackWordCount,
  isHistorical: resolved.isHistorical,
});

if (!display) {
  console.error("Failed to build authoritative display model.");
  process.exit(1);
}

const validation = validateAuthoritativeExport(display, {
  requireActive: !display.is_historical,
  expectedReviewId: reviewId,
  expectedCanonicalWordCount: 111_491,
  expectedNormalizedScore: 76.6,
});

const docxText = buildLiteraryAgentReviewDocxText(display);
const staleLength =
  /\b(?:130|150|180|200)\s*k\b/i.test(docxText) ||
  /\b(?:130,000|150,000|180,000|200,000)\s+words\b/i.test(docxText);
const modelGrade = /\bGrade:\s*[A-F][+-]?/i.test(docxText);

const outDir = path.join(root, ".review-failure-diagnostics");
fs.mkdirSync(outDir, { recursive: true });
const safeTitle = (resolved.manuscriptTitle || "manuscript")
  .replace(/[^a-zA-Z0-9._-]+/g, "_")
  .slice(0, 60);
const outPath = path.join(outDir, `${safeTitle}-literary-agent-${reviewId.slice(0, 8)}.docx`);

if (!validation.ok) {
  console.error("Export safety gates failed:");
  for (const e of validation.errors) console.error(`  - ${e}`);
  process.exit(1);
}

const buffer = await buildLiteraryAgentReviewDocx(display);
fs.writeFileSync(outPath, buffer);

console.log(
  JSON.stringify(
    {
      output_file_path: outPath,
      resolved_review_id: display.review_id,
      canonical_word_count: display.canonical_word_count,
      normalized_score: display.grading.total_score,
      safety_gates_passed: validation.ok,
      stale_length_language_absent: !staleLength,
      model_grade_absent: !modelGrade,
      concern_assessments: display.concern_assessment_count,
      lifecycle_status: display.lifecycle_status,
    },
    null,
    2,
  ),
);
