"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getManuscriptReviewContext } from "@/lib/reviews";
import { getStoryDna } from "@/lib/storydna";
import { locatePassage } from "@/lib/manuscript-context";
import {
  generateRevisionCandidates,
  generateAgentReview,
  repairCommercialReviewValidation,
} from "@/lib/ai/anthropic";
import { LITERARY_AGENT, type ParsedIssue } from "@/lib/ai/review-engine";
import type { AuthorIntent, RevisionStatus, RevisionType } from "@/lib/types";
import { buildReviewStatistics } from "@/lib/review-statistics";
import {
  buildReviewGradingRecord,
  validateCommercialReviewContent,
} from "@/lib/commercial-review-pipeline";
import { extractRubricPayload, validateCommercialRubric } from "@/lib/rubric-validation";
import { validateWordCountClaims } from "@/lib/word-count-validation";

/**
 * Editorial lifecycle statuses (manuscript-page workflow).
 * Distinct from author_edit_responses.disposition — see lib/author-response-status.ts.
 * This action never reads or writes author responses.
 */
const EDITORIAL_LIFECYCLE_STATUSES = new Set<RevisionStatus>([
  "proposed",
  "accepted",
  "rejected",
  "deferred",
]);

// Structural / advisory revision types are exported as comments, not redlines.
const COMMENT_TYPES = new Set<RevisionType>(["reorder", "move", "combine", "split", "comment_only"]);

export interface RevisionGenerationStatus {
  hasAuthorResponses: boolean;
  authorResponseCount: number;
  existingCandidateCount: number;
  existingIssueCount: number;
}

export interface GenerateRevisionsResult {
  ok: boolean;
  error?: string;
  issues?: number;
  candidates?: number;
  warnings?: string[];
  replacedPriorGeneration?: boolean;
}

export interface FreshEditorialGenerationResult {
  ok: boolean;
  error?: string;
  warnings?: string[];
  oldReviewId?: string | null;
  newReviewId?: string;
  issueCount?: number;
  candidateCount?: number;
}

function intentFromDna(
  dna: Awaited<ReturnType<typeof getStoryDna>>,
): AuthorIntent | null {
  if (!dna?.data?.summary) return null;
  const d = dna.data;
  const emo = d.emotional_promise.final ?? d.emotional_promise.proposed;
  return {
    confirmed: dna.alignment_status === "aligned",
    summary: d.summary.final ?? d.summary.proposed,
    about: d.about.final ?? d.about.proposed,
    themes: d.themes.final ?? d.themes.proposed.map((t) => t.name),
    emotionalPromise: `Beginning: ${emo.beginning}; Middle: ${emo.middle}; Ending: ${emo.ending}; After: ${emo.after_finishing}`,
  };
}

/** Confidently locate the candidate's original passage in manuscript text. */
function verifyOriginal(original: string, manuscriptText: string): boolean {
  if (!original.trim() || original.trim().length < 8) return false;
  return locatePassage(manuscriptText, original) !== null;
}

/** Preflight for regeneration UX — does not mutate data. */
export async function getRevisionGenerationStatus(
  manuscriptId: string,
): Promise<RevisionGenerationStatus> {
  const supabase = getSupabaseAdmin();
  const [responses, candidates, issues] = await Promise.all([
    supabase
      .from("author_edit_responses")
      .select("id", { count: "exact", head: true })
      .eq("manuscript_id", manuscriptId),
    supabase
      .from("revision_candidates")
      .select("id", { count: "exact", head: true })
      .eq("manuscript_id", manuscriptId),
    supabase
      .from("editorial_issues")
      .select("id", { count: "exact", head: true })
      .eq("manuscript_id", manuscriptId),
  ]);

  const authorResponseCount = responses.count ?? 0;
  return {
    hasAuthorResponses: authorResponseCount > 0,
    authorResponseCount,
    existingCandidateCount: candidates.count ?? 0,
    existingIssueCount: issues.count ?? 0,
  };
}

/**
 * Update editorial lifecycle status for a revision candidate.
 * Does NOT touch author_edit_responses or manuscript text.
 */
export async function setCandidateStatus(
  candidateId: string,
  manuscriptId: string,
  status: RevisionStatus,
): Promise<{ ok: boolean; error?: string }> {
  if (!candidateId || !manuscriptId) {
    return { ok: false, error: "Missing candidate or manuscript." };
  }
  if (!EDITORIAL_LIFECYCLE_STATUSES.has(status)) {
    return { ok: false, error: "Invalid editorial lifecycle status." };
  }

  const supabase = getSupabaseAdmin();
  const { data: candidate, error: lookupErr } = await supabase
    .from("revision_candidates")
    .select("id, manuscript_id, verified")
    .eq("id", candidateId)
    .eq("manuscript_id", manuscriptId)
    .maybeSingle();

  if (lookupErr) return { ok: false, error: lookupErr.message };
  if (!candidate) {
    return { ok: false, error: "Revision candidate not found for this manuscript." };
  }
  if (status === "accepted" && !candidate.verified) {
    return {
      ok: false,
      error:
        "Editorial accept is blocked — the original passage was not located in the manuscript.",
    };
  }

  const { error } = await supabase
    .from("revision_candidates")
    .update({ status })
    .eq("id", candidateId)
    .eq("manuscript_id", manuscriptId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/manuscripts/${manuscriptId}`);
  revalidatePath("/suggested-edits");
  return { ok: true };
}

function buildReplacementPayload(
  issues: ParsedIssue[],
  manuscriptText: string,
): { issues: Record<string, unknown>[] } {
  return {
    issues: issues.map((issue) => ({
      text: issue.text,
      area: issue.area || null,
      severity: issue.severity,
      source_section: issue.source_section || null,
      success_criterion: issue.success_criterion || null,
      candidates: issue.candidates.map((c) => {
        const type = c.type as RevisionType;
        return {
          type,
          original: c.original,
          revised: c.revised,
          locator: c.locator || null,
          word_savings: c.word_savings,
          reason: c.reason || null,
          confidence: c.confidence,
          confidence_reason: c.confidence_reason || null,
          difficulty: c.difficulty || null,
          story_risk: c.story_risk || null,
          voice_risk: c.voice_risk || null,
          commercial_impact: c.commercial_impact || null,
          reader_impact: c.reader_impact || null,
          grade_delta: c.grade_delta,
          consequence_if_unchanged: c.consequence_if_unchanged || null,
          dependencies: c.dependencies || null,
          impacts: c.impacts,
          export_mode: COMMENT_TYPES.has(type) ? "comment" : "track_change",
          verified: verifyOriginal(c.original, manuscriptText),
        };
      }),
    })),
  };
}

/**
 * Atomically replace editorial issues + candidates via PostgreSQL RPC.
 * Single transaction: delete + insert roll back together on any failure.
 * Passage verification uses manuscripts.extracted_text inside the RPC — not caller text.
 */
async function replacePriorGeneration(
  manuscriptId: string,
  reviewId: string,
  issues: ParsedIssue[],
  manuscriptText: string,
): Promise<{ issueCount: number; candidateCount: number }> {
  const supabase = getSupabaseAdmin();
  const payload = buildReplacementPayload(issues, manuscriptText);

  const { data, error } = await supabase.rpc("replace_editorial_generation", {
    p_manuscript_id: manuscriptId,
    p_review_id: reviewId,
    p_payload: payload,
  });

  if (error) {
    const msg = error.message ?? "Replacement failed.";
    if (msg.includes("AUTHOR_RESPONSES_PRESENT")) {
      throw new Error("AUTHOR_RESPONSES_PRESENT");
    }
    if (msg.includes("replace_editorial_generation")) {
      throw new Error(
        "Database migration required. Apply supabase/migrations/0017_replace_editorial_generation.sql.",
      );
    }
    if (msg.includes("REVIEW_MANUSCRIPT_MISMATCH") || msg.includes("REVIEW_NOT_FOUND")) {
      throw new Error("Literary Agent review does not belong to this manuscript.");
    }
    if (msg.includes("VERIFIED_PASSAGE_NOT_LOCATED")) {
      throw new Error("A verified candidate's original passage was not located in the manuscript.");
    }
    if (msg.includes("EXTRACTED_TEXT_REQUIRED_FOR_VERIFICATION")) {
      throw new Error("This manuscript has no extracted text — verified candidates cannot be stored.");
    }
    throw new Error(msg);
  }

  const result = data as { issue_count?: number; candidate_count?: number } | null;
  return {
    issueCount: result?.issue_count ?? 0,
    candidateCount: result?.candidate_count ?? 0,
  };
}

/**
 * Generate Editorial Issues + Revision Candidates from the latest Literary Agent review.
 * Never deletes author_edit_responses. Blocks regeneration when author responses exist.
 */
export async function generateAgentRevisions(
  manuscriptId: string,
): Promise<GenerateRevisionsResult> {
  if (!manuscriptId) return { ok: false, error: "Missing manuscript id." };

  const ctx = await getManuscriptReviewContext(manuscriptId);
  if (!ctx?.extractedText.trim()) {
    return { ok: false, error: "This manuscript has no extracted text." };
  }
  const text = ctx.extractedText;

  const supabase = getSupabaseAdmin();
  const genStatus = await getRevisionGenerationStatus(manuscriptId);
  if (genStatus.hasAuthorResponses) {
    return {
      ok: false,
      error: `Cannot regenerate revision candidates: ${genStatus.authorResponseCount} author response${
        genStatus.authorResponseCount === 1 ? " has" : "s have"
      } already been recorded in Suggested Edits. Regenerating would invalidate those decisions. Clear or complete the author-review workflow first.`,
    };
  }

  const { data: review } = await supabase
    .from("reviews")
    .select("id, content")
    .eq("manuscript_id", manuscriptId)
    .eq("perspective", "commercial")
    .eq("lifecycle_status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!review?.content) {
    return {
      ok: false,
      error: "Run the Literary Agent review first — there's nothing to turn into candidates.",
    };
  }

  const intent = intentFromDna(await getStoryDna(manuscriptId));
  const statistics = buildReviewStatistics({
    manuscriptId: ctx.manuscriptId,
    manuscriptVersionId: ctx.manuscriptVersionId,
    extractedText: text,
    sentChars: text.length,
    storedWordCount: ctx.wordCount,
    characterCount: ctx.characterCount,
  });

  let issues: ParsedIssue[];
  let warnings: string[];
  try {
    ({ issues, warnings } = await generateRevisionCandidates(
      LITERARY_AGENT,
      review.content,
      text,
      intent,
      statistics,
    ));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  if (issues.length === 0) {
    return {
      ok: false,
      error:
        warnings.length > 0
          ? `No usable revision candidates were produced. ${warnings.join(" ")}`
          : "No revision candidates were produced from the review.",
      warnings,
    };
  }

  const replacedPriorGeneration =
    genStatus.existingIssueCount > 0 || genStatus.existingCandidateCount > 0;

  try {
    const { issueCount, candidateCount } = await replacePriorGeneration(
      manuscriptId,
      review.id,
      issues,
      text,
    );
    revalidatePath(`/manuscripts/${manuscriptId}`);
    revalidatePath("/suggested-edits");
    return {
      ok: true,
      issues: issueCount,
      candidates: candidateCount,
      warnings,
      replacedPriorGeneration,
    };
  } catch (e) {
    if (e instanceof Error && e.message === "AUTHOR_RESPONSES_PRESENT") {
      return {
        ok: false,
        error:
          "Cannot regenerate: author responses were recorded while generation was in progress. No changes were saved.",
      };
    }
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      warnings,
    };
  }
}

/**
 * Fresh versioned editorial run: new Literary Agent review + atomic issue/candidate replacement.
 * AI generation runs first; DB changes happen only after both succeed via publish_commercial_review_generation.
 * Preserves superseded commercial reviews. Never touches manuscript text or author responses.
 */
export async function runFreshEditorialGeneration(
  manuscriptId: string,
): Promise<FreshEditorialGenerationResult> {
  if (!manuscriptId) return { ok: false, error: "Missing manuscript id." };

  const ctx = await getManuscriptReviewContext(manuscriptId);
  if (!ctx?.extractedText.trim()) {
    return { ok: false, error: "This manuscript has no extracted text." };
  }
  const text = ctx.extractedText;

  const supabase = getSupabaseAdmin();
  const genStatus = await getRevisionGenerationStatus(manuscriptId);
  if (genStatus.hasAuthorResponses) {
    return {
      ok: false,
      error: `Cannot regenerate: ${genStatus.authorResponseCount} author response${
        genStatus.authorResponseCount === 1 ? " has" : "s have"
      } already been recorded in Suggested Edits.`,
    };
  }

  const { data: oldActive } = await supabase
    .from("reviews")
    .select("id")
    .eq("manuscript_id", manuscriptId)
    .eq("perspective", "commercial")
    .eq("lifecycle_status", "active")
    .maybeSingle();

  const intent = intentFromDna(await getStoryDna(manuscriptId));
  const statistics = buildReviewStatistics({
    manuscriptId: ctx.manuscriptId,
    manuscriptVersionId: ctx.manuscriptVersionId,
    extractedText: text,
    sentChars: text.length,
    storedWordCount: ctx.wordCount,
    characterCount: ctx.characterCount,
  });

  let reviewResult;
  try {
    reviewResult = await generateAgentReview(text, intent, statistics);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  let content = reviewResult.content;
  let repairAttempted = false;

  let validation = validateCommercialReviewContent({
    content,
    statistics,
    reviewMeta: reviewResult.reviewMeta ?? null,
  });

  if (!validation.ok && validation.repairable && !repairAttempted) {
    repairAttempted = true;

    const { payload, parseError, categoryKeyErrors } = extractRubricPayload(content);
    const rubricGrading = validateCommercialRubric({
      payload,
      parseError,
      categoryKeyErrors,
      canonicalWordCount: statistics.canonical_word_count,
      fullTextSupplied: statistics.full_text_supplied,
      statisticsValid: validateWordCountClaims(content, statistics.canonical_word_count).valid,
    });

    try {
      const repaired = await repairCommercialReviewValidation({
        reviewContent: content,
        canonicalWordCount: statistics.canonical_word_count,
        calculatedLetterGrade: rubricGrading.letterGrade,
        manuscriptScore: rubricGrading.manuscriptScore,
        wordCountContradiction: validation.wordCountContradiction?.quotation,
        proseGradeConflict: validation.proseGradeConflict,
      });
      content = repaired.content;
    } catch (e) {
      return {
        ok: false,
        error: `Review repair failed: ${e instanceof Error ? e.message : String(e)}`,
      };
    }

    validation = validateCommercialReviewContent({
      content,
      statistics,
      reviewMeta: reviewResult.reviewMeta ?? null,
      repairAttempted: true,
    });
  }

  if (!validation.ok) {
    return { ok: false, error: validation.error ?? "Review validation failed." };
  }

  const validated = validation.result!;

  let issues: ParsedIssue[];
  let warnings: string[];
  try {
    ({ issues, warnings } = await generateRevisionCandidates(
      LITERARY_AGENT,
      validated.fullContent,
      text,
      intent,
      statistics,
    ));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  if (issues.length === 0) {
    return {
      ok: false,
      error:
        warnings.length > 0
          ? `No usable revision candidates were produced. ${warnings.join(" ")}`
          : "No revision candidates were produced from the review.",
      warnings,
    };
  }

  const payload = buildReplacementPayload(issues, text);
  const gradingRecord = buildReviewGradingRecord(validated);

  const { data, error } = await supabase.rpc("publish_commercial_review_generation", {
    p_manuscript_id: manuscriptId,
    p_provider: "openai",
    p_model: reviewResult.model,
    p_content: validated.fullContent,
    p_metadata: {
      truncated: reviewResult.truncated,
      chars_sent: reviewResult.charsSent,
      review_meta: reviewResult.reviewMeta ?? null,
      review_statistics: statistics,
    },
    p_payload: payload,
    p_grading: gradingRecord,
  });

  if (error) {
    const msg = error.message ?? "Publish failed.";
    if (msg.includes("AUTHOR_RESPONSES_PRESENT")) {
      return {
        ok: false,
        error:
          "Cannot regenerate: author responses were recorded while generation was in progress. No changes were saved.",
      };
    }
    if (msg.includes("publish_commercial_review_generation")) {
      return {
        ok: false,
        error:
          "Database migration required. Apply supabase/migrations/0018_review_lifecycle.sql.",
      };
    }
    return { ok: false, error: msg, warnings };
  }

  const result = data as {
    review_id?: string;
    issue_count?: number;
    candidate_count?: number;
  } | null;

  revalidatePath(`/manuscripts/${manuscriptId}`);
  revalidatePath("/suggested-edits");

  return {
    ok: true,
    warnings,
    oldReviewId: oldActive?.id ?? null,
    newReviewId: result?.review_id,
    issueCount: result?.issue_count ?? 0,
    candidateCount: result?.candidate_count ?? 0,
  };
}
