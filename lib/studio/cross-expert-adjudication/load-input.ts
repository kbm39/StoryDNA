import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parsePersistedMilitaryExpertFindingContent } from "@/lib/studio/military-expert-finding-content.ts";
import { extractTopicTokens } from "./manuscript-verification.ts";
import { hashAuditPayload } from "./text-normalize.ts";
import type {
  CrossExpertAuditInput,
  CrossExpertImmutabilitySnapshots,
  CrossExpertNormalizedFinding,
} from "./types.ts";

export interface CrossExpertAuditLoadArgs {
  readonly manuscriptId: string;
  readonly manuscriptVersionId: string;
  readonly literaryAgentReviewId: string;
  readonly militaryExpertReviewId: string;
  readonly supabase?: SupabaseClient;
}

function createReadOnlySupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase is not configured for cross-expert adjudication audit.");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function normalizeLiteraryAgentFinding(args: {
  readonly issue: Record<string, unknown>;
  readonly reviewId: string;
  readonly index: number;
}): CrossExpertNormalizedFinding {
  const text = String(args.issue.text ?? "");
  const area = String(args.issue.area ?? "general");
  const title = text.split(/[.!?]/)[0]?.slice(0, 120) || `Literary Agent issue ${args.index + 1}`;
  const summary = text;
  return Object.freeze({
    findingKey: `la:${String(args.issue.id ?? args.index)}`,
    source: "literary_agent",
    sourceReviewId: args.reviewId,
    sourceFindingId: args.issue.id ? String(args.issue.id) : null,
    title,
    summary,
    recommendation: text,
    category: area,
    severity: String(args.issue.severity ?? "unknown"),
    confidence: null,
    manuscriptEvidence: Object.freeze([]),
    contraryEvidence: Object.freeze([]),
    topicTokens: Object.freeze(extractTopicTokens(`${title} ${summary} ${area}`)),
  });
}

function normalizeMilitaryExpertFinding(args: {
  readonly row: Record<string, unknown>;
  readonly reviewId: string;
}): CrossExpertNormalizedFinding | null {
  const content = parsePersistedMilitaryExpertFindingContent(args.row.finding_content);
  if (!content) return null;
  const title = content.title;
  const summary = content.observation;
  return Object.freeze({
    findingKey: `me:${String(args.row.finding_id ?? args.row.finding_index)}`,
    source: "military_expert",
    sourceReviewId: args.reviewId,
    sourceFindingId: String(args.row.finding_id ?? ""),
    title,
    summary,
    recommendation: content.recommendation,
    category: String(args.row.category ?? "unknown"),
    severity: String(args.row.severity ?? "unknown"),
    confidence: String(args.row.confidence ?? "unknown"),
    manuscriptEvidence: Object.freeze(content.manuscript_evidence ?? []),
    contraryEvidence: Object.freeze(content.contrary_evidence ?? []),
    topicTokens: Object.freeze(extractTopicTokens(`${title} ${summary} ${content.recommendation}`)),
  });
}

export async function loadCrossExpertAuditInput(
  args: CrossExpertAuditLoadArgs,
): Promise<CrossExpertAuditInput> {
  const supabase = args.supabase ?? createReadOnlySupabase();

  const { data: manuscript, error: manuscriptError } = await supabase
    .from("manuscripts")
    .select("id,title,word_count,extracted_text,updated_at")
    .eq("id", args.manuscriptId)
    .maybeSingle();
  if (manuscriptError) throw new Error(manuscriptError.message);
  if (!manuscript) throw new Error(`Manuscript not found: ${args.manuscriptId}`);

  const { data: version, error: versionError } = await supabase
    .from("manuscript_versions")
    .select("id,extracted_text,word_count,content_hash")
    .eq("id", args.manuscriptVersionId)
    .maybeSingle();
  if (versionError) throw new Error(versionError.message);
  if (!version?.extracted_text) {
    throw new Error(`Manuscript version text not found: ${args.manuscriptVersionId}`);
  }

  const { data: laReview, error: laError } = await supabase
    .from("reviews")
    .select("id,content,manuscript_score,manuscript_letter_grade")
    .eq("id", args.literaryAgentReviewId)
    .maybeSingle();
  if (laError) throw new Error(laError.message);
  if (!laReview) throw new Error(`Literary Agent review not found: ${args.literaryAgentReviewId}`);

  const { data: laIssues, error: laIssuesError } = await supabase
    .from("editorial_issues")
    .select("*")
    .eq("review_id", args.literaryAgentReviewId)
    .order("created_at", { ascending: true });
  if (laIssuesError) throw new Error(laIssuesError.message);

  const { data: meReview, error: meReviewError } = await supabase
    .from("studio_military_expert_draft_reviews")
    .select("id")
    .eq("id", args.militaryExpertReviewId)
    .maybeSingle();
  if (meReviewError) throw new Error(meReviewError.message);
  if (!meReview) throw new Error(`Military Expert review not found: ${args.militaryExpertReviewId}`);

  const { data: meFindingRows, error: meFindingsError } = await supabase
    .from("studio_military_expert_draft_findings")
    .select("*")
    .eq("review_id", args.militaryExpertReviewId)
    .order("finding_index", { ascending: true });
  if (meFindingsError) throw new Error(meFindingsError.message);

  const literaryAgentFindings = (laIssues ?? []).map((issue, index) =>
    normalizeLiteraryAgentFinding({ issue, reviewId: args.literaryAgentReviewId, index }),
  );
  const militaryExpertFindings = (meFindingRows ?? [])
    .map((row) => normalizeMilitaryExpertFinding({ row, reviewId: args.militaryExpertReviewId }))
    .filter((finding): finding is CrossExpertNormalizedFinding => finding !== null);

  const immutabilitySnapshots = buildImmutabilitySnapshots({
    manuscriptText: version.extracted_text,
    literaryAgentReviewContent: laReview.content ?? "",
    militaryExpertFindingRows: meFindingRows ?? [],
    literaryAgentIssues: laIssues ?? [],
  });

  return Object.freeze({
    manuscriptId: args.manuscriptId,
    manuscriptVersionId: args.manuscriptVersionId,
    manuscriptTitle: String(manuscript.title ?? "Unknown"),
    wordCount: Number(version.word_count ?? manuscript.word_count ?? 0),
    manuscriptText: version.extracted_text,
    literaryAgentReviewId: args.literaryAgentReviewId,
    militaryExpertReviewId: args.militaryExpertReviewId,
    literaryAgentFindings,
    militaryExpertFindings,
    literaryAgentReviewContent: laReview.content ?? "",
    literaryAgentScore:
      laReview.manuscript_score == null ? null : Number(laReview.manuscript_score),
    literaryAgentLetterGrade: laReview.manuscript_letter_grade ?? null,
    immutabilitySnapshots,
  });
}

export function buildImmutabilitySnapshots(args: {
  readonly manuscriptText: string;
  readonly literaryAgentReviewContent: string;
  readonly militaryExpertFindingRows: readonly Record<string, unknown>[];
  readonly literaryAgentIssues: readonly Record<string, unknown>[];
}): CrossExpertImmutabilitySnapshots {
  return Object.freeze({
    manuscriptContentHash: hashAuditPayload(args.manuscriptText),
    literaryAgentReviewHash: hashAuditPayload(args.literaryAgentReviewContent),
    militaryExpertReviewHash: hashAuditPayload(JSON.stringify(args.militaryExpertFindingRows)),
    literaryAgentIssueHashes: Object.freeze(
      args.literaryAgentIssues.map((issue) => hashAuditPayload(JSON.stringify(issue))),
    ),
    militaryExpertFindingHashes: Object.freeze(
      args.militaryExpertFindingRows.map((row) => hashAuditPayload(JSON.stringify(row))),
    ),
  });
}

export async function verifyImmutabilitySnapshots(args: {
  readonly input: CrossExpertAuditInput;
  readonly supabase?: SupabaseClient;
}): Promise<{ readonly unchanged: boolean; readonly violations: readonly string[] }> {
  const reloaded = await loadCrossExpertAuditInput({
    manuscriptId: args.input.manuscriptId,
    manuscriptVersionId: args.input.manuscriptVersionId,
    literaryAgentReviewId: args.input.literaryAgentReviewId,
    militaryExpertReviewId: args.input.militaryExpertReviewId,
    supabase: args.supabase,
  });
  const violations: string[] = [];
  const before = args.input.immutabilitySnapshots;
  const after = reloaded.immutabilitySnapshots;
  if (before.manuscriptContentHash !== after.manuscriptContentHash) {
    violations.push("manuscript content hash changed");
  }
  if (before.literaryAgentReviewHash !== after.literaryAgentReviewHash) {
    violations.push("literary agent review hash changed");
  }
  if (before.militaryExpertReviewHash !== after.militaryExpertReviewHash) {
    violations.push("military expert review hash changed");
  }
  return Object.freeze({ unchanged: violations.length === 0, violations: Object.freeze(violations) });
}
