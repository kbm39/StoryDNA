#!/usr/bin/env node
/**
 * Read-only audit: active commercial reviews with stale or contradictory length language.
 * Does not delete, mutate, supersede, or regenerate anything.
 *
 * Usage: node --env-file=.env.local scripts/audit-stale-commercial-reviews.mjs
 */
import pg from "pg";

const PRE_ENFORCEMENT = "Pre-enforcement — generated before canonical word-count validation.";
const CONTRADICTS = "Contradicts canonical statistics";

function hasFalseLengthLanguage(memo, canonical) {
  if (canonical <= 0) return false;
  for (const k of [130, 150, 180, 200]) {
    const kPattern = new RegExp(
      `\\b(?:about|approximately|roughly|over|around|~|well\\s+past|reads?\\s+well\\s+past)?\\s*${k}\\s*k(?:\\s*-?\\s*ish)?\\b`,
      "gi",
    );
    if (kPattern.test(memo)) return true;
    const formatted = new RegExp(`\\b${k},?000\\s+words\\b`, "gi");
    if (formatted.test(memo) && Math.abs(k * 1000 - canonical) > 1000) return true;
  }
  return /\b(?:north of|comfortably north of)\s+130\b/i.test(memo);
}

async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error("SUPABASE_DB_URL is required");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const { rows } = await client.query(`
    select r.id as review_id,
           r.manuscript_id,
           m.title as manuscript_title,
           r.lifecycle_status,
           r.created_at,
           r.canonical_word_count,
           r.scoring_gate_valid,
           r.manuscript_version_id,
           mv.word_count as version_word_count,
           m.current_version_id,
           r.model,
           r.content
    from reviews r
    join manuscripts m on m.id = r.manuscript_id
    left join manuscript_versions mv on mv.id = r.manuscript_version_id
    where r.perspective = 'commercial'
      and r.lifecycle_status = 'active'
    order by r.created_at desc`);

  const flagged = [];

  for (const row of rows) {
    const memo = row.content.split("<!-- STORYDNA_RUBRIC_JSON -->")[0];
    const canonical =
      row.canonical_word_count ??
      row.version_word_count ??
      null;
    const preEnforcement =
      row.canonical_word_count == null || row.scoring_gate_valid !== true;
    const versionMismatch =
      row.current_version_id &&
      row.manuscript_version_id &&
      row.current_version_id !== row.manuscript_version_id;
    const contradicts =
      canonical != null &&
      canonical > 0 &&
      hasFalseLengthLanguage(memo, canonical);

    if (!preEnforcement && !contradicts && !versionMismatch) continue;

    const warnings = [];
    if (preEnforcement) warnings.push(PRE_ENFORCEMENT);
    if (contradicts) warnings.push(CONTRADICTS);
    if (versionMismatch) warnings.push("Version mismatch with current manuscript version");

    flagged.push({
      review_id: row.review_id,
      manuscript_id: row.manuscript_id,
      manuscript_title: row.manuscript_title,
      created_at: row.created_at,
      model: row.model,
      canonical_word_count: canonical,
      warnings: warnings.join("; "),
      remediation: preEnforcement || contradicts
        ? "Regenerate Literary Agent review under current enforcement rules"
        : "Regenerate or supersede after uploading matching manuscript version",
    });
  }

  console.log(`Audited ${rows.length} active commercial reviews`);
  console.log(`Flagged ${flagged.length} stale or contradictory reviews\n`);
  if (flagged.length === 0) {
    console.log("No stale active commercial reviews found.");
  } else {
    console.table(flagged);
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
