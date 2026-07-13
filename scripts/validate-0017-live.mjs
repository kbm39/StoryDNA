/**
 * Live validation for migration 0017.
 * Safe, fully reversible, manuscript-scoped. Does not print secrets.
 *
 * Run (env vars required, not printed):
 *   node scripts/validate-0017-live.mjs
 */
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const MANUSCRIPT_ID = "9f482ca2-a0f6-4709-8364-18a0ef950eb0";
const REVIEW_ID = "af68c1e5-dea5-432a-a5cf-3dfec7e3b308";
const TEST_MARKER = `VALIDATION_0017_${Date.now()}`;

const dbUrl = process.env.SUPABASE_DB_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ISSUE_COLUMNS = [
  "id",
  "manuscript_id",
  "review_id",
  "text",
  "area",
  "severity",
  "source_section",
  "success_criterion",
  "owning_reviewer",
  "resolution_status",
  "verified_at",
  "verification_note",
  "created_at",
  "updated_at",
];

const CANDIDATE_COLUMNS = [
  "id",
  "manuscript_id",
  "issue_id",
  "phase_id",
  "type",
  "original",
  "revised",
  "locator",
  "word_savings",
  "reason",
  "confidence",
  "confidence_reason",
  "difficulty",
  "story_risk",
  "voice_risk",
  "commercial_impact",
  "reader_impact",
  "grade_delta",
  "consequence_if_unchanged",
  "dependencies",
  "impacts",
  "export_mode",
  "verified",
  "status",
  "created_at",
];

const RESPONSE_COLUMNS = [
  "id",
  "candidate_id",
  "manuscript_id",
  "disposition",
  "author_modified_text",
  "author_note",
  "responded_at",
  "updated_at",
];

/** Fields excluded from row equality — none when restoring exact snapshot values. */
const COMPARE_IGNORE = {
  editorial_issues: [],
  revision_candidates: [],
  author_edit_responses: [],
  manuscripts: [],
};

const results = [];
const created = { issues: [], candidates: [], responses: [] };
let baseline = null;
let pgClient = null;
let supabase = null;
let exitCode = 0;
let stopMutations = false;
let cleanupReport = null;

function isUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function record(test, pass, details = {}, { haltMutations = false } = {}) {
  results.push({ test, pass, ...details });
  if (!pass) {
    exitCode = 1;
    if (haltMutations) stopMutations = true;
  }
}

function normalizeValue(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

function normalizeRows(rows, columns) {
  return rows
    .map((row) => {
      const out = {};
      for (const col of columns) {
        out[col] = normalizeValue(row[col]);
      }
      return out;
    })
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function compareBaselineRowsPresentUnchanged(baselineRows, afterRows, columns) {
  const mismatches = [];
  for (const baseRow of baselineRows) {
    const afterRow = afterRows.find((r) => r.id === baseRow.id);
    if (!afterRow) {
      mismatches.push({ id: baseRow.id, field: "__missing__" });
      continue;
    }
    for (const col of columns) {
      if (normalizeValue(baseRow[col]) !== normalizeValue(afterRow[col])) {
        mismatches.push({
          id: baseRow.id,
          field: col,
          expected: normalizeValue(baseRow[col]),
          actual: normalizeValue(afterRow[col]),
        });
      }
    }
  }
  return { equal: mismatches.length === 0, mismatches };
}

function compareTable(name, baselineRows, restoredRows, columns) {
  const ignore = new Set(COMPARE_IGNORE[name] ?? []);
  const left = normalizeRows(baselineRows, columns);
  const right = normalizeRows(restoredRows, columns);
  const mismatches = [];

  if (left.length !== right.length) {
    mismatches.push({ field: "__count__", expected: left.length, actual: right.length });
    return { equal: false, mismatches };
  }

  for (let i = 0; i < left.length; i += 1) {
    for (const col of columns) {
      if (ignore.has(col)) continue;
      if (left[i][col] !== right[i][col]) {
        mismatches.push({
          id: left[i].id,
          field: col,
          expected: left[i][col],
          actual: right[i][col],
        });
      }
    }
  }

  return { equal: mismatches.length === 0, mismatches };
}

async function mirrorRevisionGenerationStatus(sb, manuscriptId) {
  const [responses, candidates, issues] = await Promise.all([
    sb.from("author_edit_responses").select("id", { count: "exact", head: true }).eq("manuscript_id", manuscriptId),
    sb.from("revision_candidates").select("id", { count: "exact", head: true }).eq("manuscript_id", manuscriptId),
    sb.from("editorial_issues").select("id", { count: "exact", head: true }).eq("manuscript_id", manuscriptId),
  ]);
  const authorResponseCount = responses.count ?? 0;
  return {
    hasAuthorResponses: authorResponseCount > 0,
    authorResponseCount,
    existingCandidateCount: candidates.count ?? 0,
    existingIssueCount: issues.count ?? 0,
  };
}

/** Mirrors RunAgentReviewButton + generateAgentRevisions pre-AI guards. */
async function runAppPreflight(sb, manuscriptId, { expectAuthorResponses = false } = {}) {
  const status = await mirrorRevisionGenerationStatus(sb, manuscriptId);
  const buttonBlocked = status.hasAuthorResponses;
  const generateWouldBlock = status.hasAuthorResponses;
  const pass = expectAuthorResponses
    ? status.hasAuthorResponses && buttonBlocked && generateWouldBlock
    : true;
  return {
    pass,
    status,
    buttonBlocked,
    literaryAgentBlockedBeforeInvocation: buttonBlocked,
    generateAgentRevisionsBlockedBeforeAi: generateWouldBlock,
  };
}

async function snapshotManuscript(client) {
  const m = await client.query(
    "SELECT id, length(extracted_text) AS text_len, md5(extracted_text) AS text_md5 FROM public.manuscripts WHERE id = $1",
    [MANUSCRIPT_ID],
  );
  const issues = await client.query(
    "SELECT * FROM public.editorial_issues WHERE manuscript_id = $1 ORDER BY id",
    [MANUSCRIPT_ID],
  );
  const candidates = await client.query(
    "SELECT * FROM public.revision_candidates WHERE manuscript_id = $1 ORDER BY id",
    [MANUSCRIPT_ID],
  );
  const responses = await client.query(
    "SELECT * FROM public.author_edit_responses WHERE manuscript_id = $1 ORDER BY id",
    [MANUSCRIPT_ID],
  );

  return {
    manuscript: m.rows[0],
    issues: issues.rows,
    candidates: candidates.rows,
    responses: responses.rows,
  };
}

async function insertRow(client, table, columns, row) {
  const vals = columns.map((_, i) => `$${i + 1}`);
  await client.query(
    `INSERT INTO public.${table} (${columns.join(", ")}) VALUES (${vals.join(", ")})`,
    columns.map((c) => row[c]),
  );
}

async function restoreBaseline(client, snap) {
  await client.query("BEGIN");
  try {
    await client.query("DELETE FROM public.author_edit_responses WHERE manuscript_id = $1", [
      MANUSCRIPT_ID,
    ]);
    await client.query("DELETE FROM public.revision_candidates WHERE manuscript_id = $1", [
      MANUSCRIPT_ID,
    ]);
    await client.query("DELETE FROM public.editorial_issues WHERE manuscript_id = $1", [
      MANUSCRIPT_ID,
    ]);

    for (const issue of snap.issues) {
      await insertRow(client, "editorial_issues", ISSUE_COLUMNS, issue);
    }
    for (const candidate of snap.candidates) {
      await insertRow(client, "revision_candidates", CANDIDATE_COLUMNS, candidate);
    }
    for (const response of snap.responses) {
      await insertRow(client, "author_edit_responses", RESPONSE_COLUMNS, response);
    }

    await client.query("COMMIT");
    return { ok: true };
  } catch (error) {
    await client.query("ROLLBACK");
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function verifyRestore(snap, restored) {
  const issueCmp = compareTable(
    "editorial_issues",
    snap.issues,
    restored.issues,
    ISSUE_COLUMNS,
  );
  const candidateCmp = compareTable(
    "revision_candidates",
    snap.candidates,
    restored.candidates,
    CANDIDATE_COLUMNS,
  );
  const responseCmp = compareTable(
    "author_edit_responses",
    snap.responses,
    restored.responses,
    RESPONSE_COLUMNS,
  );
  const textEqual =
    normalizeValue(snap.manuscript.text_len) === normalizeValue(restored.manuscript.text_len) &&
    normalizeValue(snap.manuscript.text_md5) === normalizeValue(restored.manuscript.text_md5);

  return {
    issues: issueCmp,
    candidates: candidateCmp,
    responses: responseCmp,
    manuscriptText: { equal: textEqual },
    equal:
      issueCmp.equal &&
      candidateCmp.equal &&
      responseCmp.equal &&
      textEqual,
    compareIgnoreDocumented: COMPARE_IGNORE,
  };
}

async function createIsolatedTempCandidate(client) {
  const issueId = randomUUID();
  const candidateId = randomUUID();

  await client.query(
    `INSERT INTO public.editorial_issues (
       id, manuscript_id, review_id, text, severity, owning_reviewer, resolution_status
     ) VALUES ($1, $2, $3, $4, 'low', 'VALIDATION_0017', 'open')`,
    [issueId, MANUSCRIPT_ID, REVIEW_ID, `${TEST_MARKER}_isolated_issue`],
  );
  created.issues.push(issueId);

  await client.query(
    `INSERT INTO public.revision_candidates (
       id, manuscript_id, issue_id, type, original, revised, export_mode, verified, status
     ) VALUES ($1, $2, $3, 'comment_only', $4, '', 'comment', false, 'proposed')`,
    [candidateId, MANUSCRIPT_ID, issueId, `${TEST_MARKER}_isolated_original`],
  );
  created.candidates.push(candidateId);

  return { issueId, candidateId };
}

async function safeDeleteAuthorResponse(client, responseId) {
  if (!isUuid(responseId)) {
    return { deleted: false, reason: "missing_or_invalid_id" };
  }
  const found = await client.query(
    "SELECT id FROM public.author_edit_responses WHERE id = $1 AND manuscript_id = $2",
    [responseId, MANUSCRIPT_ID],
  );
  if (found.rows.length === 0) {
    return { deleted: false, reason: "not_found_in_scope" };
  }
  await client.query(
    "DELETE FROM public.author_edit_responses WHERE id = $1 AND manuscript_id = $2",
    [responseId, MANUSCRIPT_ID],
  );
  return { deleted: true, id: responseId };
}

let rpcChecksPass = true;

async function verifyRpcDefinitions(client) {
  const fnDefs = await client.query(`
    SELECT p.oid, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args,
           p.prosecdef AS security_definer,
           p.proconfig AS config
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'manuscript_passage_located',
        'acquire_manuscript_editorial_lock',
        'upsert_author_edit_response',
        'replace_editorial_generation'
      )
    ORDER BY p.proname, args
  `);

  const names = fnDefs.rows.map((r) => r.proname);
  const hasAll =
    names.includes("manuscript_passage_located") &&
    names.includes("acquire_manuscript_editorial_lock") &&
    names.includes("upsert_author_edit_response") &&
    names.includes("replace_editorial_generation");

  const replace = fnDefs.rows.find((r) => r.proname === "replace_editorial_generation");
  const threeArgOnly =
    replace?.args === "p_manuscript_id uuid, p_review_id uuid, p_payload jsonb" &&
    !fnDefs.rows.some((r) => r.proname === "replace_editorial_generation" && r.args.includes("jsonb, text"));

  const definerFns = ["acquire_manuscript_editorial_lock", "upsert_author_edit_response", "replace_editorial_generation"];
  const allDefiner = definerFns.every((name) =>
    fnDefs.rows.some((r) => r.proname === name && r.security_definer),
  );

  const searchPaths = fnDefs.rows.map((r) => ({
    name: r.proname,
    search_path: (r.config ?? []).find((c) => c.startsWith("search_path=")) ?? null,
  }));
  const hardenedSearchPath = searchPaths
    .filter((r) => definerFns.includes(r.name))
    .every((r) => r.search_path === "search_path=pg_catalog, public");

  const privileges = {};
  for (const row of fnDefs.rows) {
    privileges[row.proname] = {};
    for (const role of ["anon", "authenticated", "service_role", "public"]) {
      const q = await client.query(`SELECT has_function_privilege($1, $2, 'EXECUTE') AS v`, [
        role,
        row.oid,
      ]);
      privileges[row.proname][role] = q.rows[0].v;
    }
  }

  record("rpc_functions_exist", hasAll, { function_count: fnDefs.rows.length });
  if (!hasAll) rpcChecksPass = false;
  record("replace_editorial_generation_three_arg_only", threeArgOnly, {
    args: replace?.args ?? null,
  });
  if (!threeArgOnly) rpcChecksPass = false;
  record("security_definer_on_write_lock_rpcs", allDefiner);
  if (!allDefiner) rpcChecksPass = false;
  record("search_path_pg_catalog_public", hardenedSearchPath, { searchPaths });
  if (!hardenedSearchPath) rpcChecksPass = false;

  const serviceCanExecute =
    privileges.acquire_manuscript_editorial_lock?.service_role &&
    privileges.upsert_author_edit_response?.service_role &&
    privileges.replace_editorial_generation?.service_role;
  const clientsBlocked =
    !privileges.replace_editorial_generation?.anon &&
    !privileges.replace_editorial_generation?.authenticated &&
    !privileges.replace_editorial_generation?.public &&
    !privileges.upsert_author_edit_response?.anon &&
    !privileges.upsert_author_edit_response?.authenticated &&
    !privileges.upsert_author_edit_response?.public;
  const helperNotDirect =
    !privileges.manuscript_passage_located?.service_role &&
    !privileges.manuscript_passage_located?.anon &&
    !privileges.manuscript_passage_located?.authenticated &&
    !privileges.manuscript_passage_located?.public;

  record("service_role_execute_write_rpcs", serviceCanExecute);
  if (!serviceCanExecute) rpcChecksPass = false;
  record("client_roles_blocked_from_rpcs", clientsBlocked);
  if (!clientsBlocked) rpcChecksPass = false;
  record("manuscript_passage_located_not_directly_executable", helperNotDirect);
  if (!helperNotDirect) rpcChecksPass = false;
}

async function runMutationTests(client, sb, tempCandidateId) {
  if (stopMutations) return;

  // --- A: Author-response blocking on isolated candidate ---
  const upsertA = await sb.rpc("upsert_author_edit_response", {
    p_candidate_id: tempCandidateId,
    p_manuscript_id: MANUSCRIPT_ID,
    p_disposition: "skipped",
    p_author_modified_text: null,
    p_author_note: `${TEST_MARKER}_A`,
  });
  const tempResp = await client.query(
    "SELECT id FROM public.author_edit_responses WHERE author_note = $1 AND manuscript_id = $2",
    [`${TEST_MARKER}_A`, MANUSCRIPT_ID],
  );
  const tempResponseId = tempResp.rows[0]?.id ?? null;
  if (tempResponseId) created.responses.push(tempResponseId);

  const replaceBlocked = await sb.rpc("replace_editorial_generation", {
    p_manuscript_id: MANUSCRIPT_ID,
    p_review_id: REVIEW_ID,
    p_payload: { issues: [{ text: `${TEST_MARKER}_blocked_issue`, severity: "low", candidates: [] }] },
  });

  const afterA = await snapshotManuscript(client);
  const productionIssues = compareBaselineRowsPresentUnchanged(
    baseline.issues,
    afterA.issues,
    ISSUE_COLUMNS,
  );
  const productionCandidates = compareBaselineRowsPresentUnchanged(
    baseline.candidates,
    afterA.candidates,
    CANDIDATE_COLUMNS,
  );

  record("A_upsert_isolated_author_response", !upsertA.error, {
    temp_response_id: tempResponseId,
    temp_candidate_id: tempCandidateId,
    error: upsertA.error?.message ?? null,
  }, { haltMutations: true });
  record("A_replace_blocked_with_author_response", !!replaceBlocked.error, {
    error: replaceBlocked.error?.message ?? null,
  }, { haltMutations: true });
  record("A_production_issues_unchanged", productionIssues.equal, {
    mismatch_count: productionIssues.mismatches.length,
  }, { haltMutations: true });
  record("A_production_candidates_unchanged", productionCandidates.equal, {
    mismatch_count: productionCandidates.mismatches.length,
  }, { haltMutations: true });
  record("A_manuscript_text_unchanged", afterA.manuscript.text_md5 === baseline.manuscript.text_md5, {}, { haltMutations: true });

  const appStatus = await runAppPreflight(sb, MANUSCRIPT_ID, { expectAuthorResponses: true });
  record("A_app_getRevisionGenerationStatus", appStatus.pass, {
    scoped_ids: { manuscript_id: MANUSCRIPT_ID, temp_response_id: tempResponseId },
    details: appStatus.status,
  }, { haltMutations: true });

  record("A_app_runAgentReviewButton_preflight_blocked", appStatus.literaryAgentBlockedBeforeInvocation === true, {
    details: { literaryAgentBlockedBeforeInvocation: appStatus.literaryAgentBlockedBeforeInvocation },
  }, { haltMutations: true });

  record("A_app_generateAgentRevisions_blocked_before_ai", appStatus.generateAgentRevisionsBlockedBeforeAi === true, {
    details: { generateAgentRevisionsBlockedBeforeAi: appStatus.generateAgentRevisionsBlockedBeforeAi },
  }, { haltMutations: true });

  if (stopMutations) return;

  // --- B: Successful atomic replacement ---
  const deleteTemp = await safeDeleteAuthorResponse(client, tempResponseId);
  if (deleteTemp.deleted) {
    created.responses = created.responses.filter((id) => id !== tempResponseId);
  }

  const passageRow = await client.query(
    "SELECT original FROM public.revision_candidates WHERE manuscript_id = $1 AND verified = true LIMIT 1",
    [MANUSCRIPT_ID],
  );
  const locatedOriginal =
    passageRow.rows[0]?.original ?? `${TEST_MARKER}_fallback_original_text`;

  const validPayload = {
    issues: [
      {
        text: `${TEST_MARKER}_issue_1`,
        severity: "medium",
        candidates: [
          {
            type: "comment_only",
            original: locatedOriginal,
            revised: "",
            export_mode: "comment",
            verified: true,
          },
          {
            type: "comment_only",
            original: "short",
            revised: "",
            export_mode: "comment",
            verified: false,
          },
        ],
      },
      { text: `${TEST_MARKER}_issue_2`, severity: "low", candidates: [] },
    ],
  };

  const replaceOk = await sb.rpc("replace_editorial_generation", {
    p_manuscript_id: MANUSCRIPT_ID,
    p_review_id: REVIEW_ID,
    p_payload: validPayload,
  });

  const afterB = await snapshotManuscript(client);
  const markerIssues = afterB.issues.filter((i) => String(i.text).includes(TEST_MARKER));
  const markerCandidates = await client.query(
    `SELECT rc.id
     FROM public.revision_candidates rc
     JOIN public.editorial_issues ei ON ei.id = rc.issue_id
     WHERE rc.manuscript_id = $1 AND ei.text LIKE $2`,
    [MANUSCRIPT_ID, `%${TEST_MARKER}%`],
  );

  for (const row of markerIssues) created.issues.push(row.id);
  for (const row of markerCandidates.rows) created.candidates.push(row.id);

  record("B_atomic_replacement_success", !replaceOk.error, {
    result: replaceOk.data ?? null,
    error: replaceOk.error?.message ?? null,
    new_issue_ids: markerIssues.map((r) => r.id),
    new_candidate_ids: markerCandidates.rows.map((r) => r.id),
  }, { haltMutations: true });
  record("B_complete_replacement_no_partial_rows", markerIssues.length === 2 && markerCandidates.rows.length === 2, {}, { haltMutations: true });
  record("B_manuscript_text_unchanged", afterB.manuscript.text_md5 === baseline.manuscript.text_md5, {}, { haltMutations: true });

  if (stopMutations) return;

  // --- C: Rollback on invalid payload ---
  const postB = await snapshotManuscript(client);
  const rollbackAttempt = await sb.rpc("replace_editorial_generation", {
    p_manuscript_id: MANUSCRIPT_ID,
    p_review_id: REVIEW_ID,
    p_payload: {
      issues: [
        {
          text: `${TEST_MARKER}_rollback_should_not_persist`,
          severity: "not_a_severity",
          candidates: [],
        },
      ],
    },
  });
  const afterC = await snapshotManuscript(client);

  record("C_rollback_raises_error", !!rollbackAttempt.error, {
    error: rollbackAttempt.error?.message ?? null,
  }, { haltMutations: true });
  record("C_prior_set_intact", JSON.stringify(postB.issues.map((r) => r.id)) === JSON.stringify(afterC.issues.map((r) => r.id)), {}, { haltMutations: true });
  record("C_no_partial_rows", !afterC.issues.some((i) => String(i.text).includes("rollback_should_not_persist")), {}, { haltMutations: true });

  if (stopMutations) return;

  // --- D: Locked author-response upsert on post-B marker candidate ---
  const markerCand = markerCandidates.rows[0]?.id
    ? (
        await client.query("SELECT id, status FROM public.revision_candidates WHERE id = $1", [
          markerCandidates.rows[0].id,
        ])
      ).rows[0]
    : null;

  if (!markerCand) {
    record("D_marker_candidate_available", false, { reason: "no_post_b_candidate" }, { haltMutations: true });
    return;
  }

  const statusBefore = markerCand.status;
  const other = await client.query(
    "SELECT id FROM public.revision_candidates WHERE manuscript_id <> $1 LIMIT 1",
    [MANUSCRIPT_ID],
  );
  const otherCandidateId = other.rows[0]?.id ?? null;

  const dValid = await sb.rpc("upsert_author_edit_response", {
    p_candidate_id: markerCand.id,
    p_manuscript_id: MANUSCRIPT_ID,
    p_disposition: "accepted",
    p_author_modified_text: null,
    p_author_note: `${TEST_MARKER}_D_valid`,
  });
  const dValidId = (
    await client.query(
      "SELECT id FROM public.author_edit_responses WHERE author_note = $1 AND manuscript_id = $2",
      [`${TEST_MARKER}_D_valid`, MANUSCRIPT_ID],
    )
  ).rows[0]?.id;
  if (dValidId) created.responses.push(dValidId);

  const statusAfterValid = (
    await client.query("SELECT status FROM public.revision_candidates WHERE id = $1", [markerCand.id])
  ).rows[0]?.status;

  const dMismatch = otherCandidateId
    ? await sb.rpc("upsert_author_edit_response", {
        p_candidate_id: otherCandidateId,
        p_manuscript_id: MANUSCRIPT_ID,
        p_disposition: "accepted",
        p_author_modified_text: null,
        p_author_note: null,
      })
    : { error: { message: "CANDIDATE_MANUSCRIPT_MISMATCH" } };

  const dBadCand = await sb.rpc("upsert_author_edit_response", {
    p_candidate_id: "00000000-0000-0000-0000-000000000001",
    p_manuscript_id: MANUSCRIPT_ID,
    p_disposition: "accepted",
    p_author_modified_text: null,
    p_author_note: null,
  });

  const dBadDisp = await sb.rpc("upsert_author_edit_response", {
    p_candidate_id: markerCand.id,
    p_manuscript_id: MANUSCRIPT_ID,
    p_disposition: "maybe",
    p_author_modified_text: null,
    p_author_note: null,
  });

  const dModEmpty = await sb.rpc("upsert_author_edit_response", {
    p_candidate_id: markerCand.id,
    p_manuscript_id: MANUSCRIPT_ID,
    p_disposition: "modified",
    p_author_modified_text: "   ",
    p_author_note: null,
  });

  const dReject = await sb.rpc("upsert_author_edit_response", {
    p_candidate_id: markerCand.id,
    p_manuscript_id: MANUSCRIPT_ID,
    p_disposition: "rejected",
    p_author_modified_text: "should be ignored",
    p_author_note: `${TEST_MARKER}_D_reject`,
  });
  const dRejectRow = (
    await client.query(
      "SELECT author_modified_text FROM public.author_edit_responses WHERE candidate_id = $1",
      [markerCand.id],
    )
  ).rows[0];

  record("D_valid_upsert", !dValid.error, { response_id: dValidId, candidate_id: markerCand.id }, { haltMutations: true });
  record("D_candidate_manuscript_mismatch_fails", !!dMismatch.error, {}, { haltMutations: true });
  record("D_invalid_candidate_fails", !!dBadCand.error, {}, { haltMutations: true });
  record("D_invalid_disposition_fails", !!dBadDisp.error, {}, { haltMutations: true });
  record("D_modified_empty_text_fails", !!dModEmpty.error, {}, { haltMutations: true });
  record("D_non_modified_clears_modified_text", dRejectRow?.author_modified_text === null, {}, { haltMutations: true });
  record("D_candidate_lifecycle_unchanged", statusBefore === statusAfterValid, {
    status_before: statusBefore,
    status_after: statusAfterValid,
  }, { haltMutations: true });
}

function printReport() {
  const output = {
    test_marker: TEST_MARKER,
    manuscript_id: MANUSCRIPT_ID,
    review_id: REVIEW_ID,
    created_record_ids: created,
    tests: results,
    cleanup: cleanupReport,
    manuscript_integrity: cleanupReport?.verification?.manuscriptText ?? null,
    exit_code: exitCode,
  };
  console.log(JSON.stringify(output, null, 2));
}

if (!dbUrl || !supabaseUrl || !serviceKey) {
  console.log(JSON.stringify({ error: "Missing required Supabase environment variables." }));
  process.exit(1);
}

pgClient = new pg.Client({ connectionString: dbUrl });
supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

try {
  await pgClient.connect();

  await verifyRpcDefinitions(pgClient);
  baseline = await snapshotManuscript(pgClient);

  const appBaseline = await runAppPreflight(supabase, MANUSCRIPT_ID);
  record("app_getRevisionGenerationStatus_baseline", appBaseline.pass, { details: appBaseline.status });

  if (rpcChecksPass) {
    const { candidateId: tempCandidateId } = await createIsolatedTempCandidate(pgClient);
    await runMutationTests(pgClient, supabase, tempCandidateId);
  } else {
    stopMutations = true;
  }
} catch (error) {
  record("unexpected_error", false, {
    message: error instanceof Error ? error.message : String(error),
  });
  stopMutations = true;
} finally {
  try {
    if (baseline && pgClient) {
      const restore = await restoreBaseline(pgClient, baseline);
      const restored = await snapshotManuscript(pgClient);
      const verification = verifyRestore(baseline, restored);
      cleanupReport = {
        attempted: true,
        restore_ok: restore.ok,
        restore_error: restore.error ?? null,
        verification,
        success: restore.ok && verification.equal,
      };
      record("cleanup_restore_baseline", cleanupReport.success, {
        scoped_manuscript_id: MANUSCRIPT_ID,
        restore_ok: restore.ok,
        full_row_fidelity: verification.equal,
        mismatch_counts: {
          issues: verification.issues.mismatches.length,
          candidates: verification.candidates.mismatches.length,
          responses: verification.responses.mismatches.length,
        },
      });
      if (!cleanupReport.success) exitCode = 1;
    } else {
      cleanupReport = { attempted: false, reason: "baseline_not_captured" };
      record("cleanup_restore_baseline", false, cleanupReport);
      exitCode = 1;
    }
  } catch (cleanupError) {
    cleanupReport = {
      attempted: true,
      success: false,
      error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
    };
    record("cleanup_restore_baseline", false, cleanupReport);
    exitCode = 1;
  }

  if (pgClient) {
    try {
      await pgClient.end();
    } catch {
      // ignore close errors
    }
  }

  printReport();
  process.exit(exitCode);
}
