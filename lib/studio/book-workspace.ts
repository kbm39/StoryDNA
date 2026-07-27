import "server-only";
import { getEditorialIssues, getRevisionCandidates } from "@/lib/agent-revisions.ts";
import { getManuscriptMeta, getManuscriptReviewContext, listReviews } from "@/lib/reviews.ts";
import { getAuthorEditResponses } from "@/lib/suggested-edits.ts";
import { getSupabaseAdmin } from "@/lib/supabase/server.ts";
import { getSeries } from "@/lib/series.ts";
import type { StudioBookWorkspace, StudioReviewSummary, StudioVersionSummary } from "./types.ts";
import { countAcceptedRevisions } from "./decisions.ts";

async function listManuscriptVersions(manuscriptId: string, currentVersionId: string | null) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("manuscript_versions")
    .select("id, version_number, label, word_count, created_at")
    .eq("manuscript_id", manuscriptId)
    .order("version_number", { ascending: false });
  return (data ?? []).map(
    (row): StudioVersionSummary =>
      Object.freeze({
        id: row.id as string,
        versionNumber: row.version_number as number,
        label: (row.label as string | null) ?? null,
        wordCount: (row.word_count as number | null) ?? null,
        createdAt: row.created_at as string,
        isCurrent: currentVersionId === row.id,
      }),
  );
}

export async function getStudioBookWorkspace(bookId: string): Promise<StudioBookWorkspace | null> {
  const meta = await getManuscriptMeta(bookId);
  if (!meta) return null;

  const [ctx, series, reviews, issues, candidates, { responses }, versions] = await Promise.all([
    getManuscriptReviewContext(bookId),
    meta.series_id ? getSeries(meta.series_id) : Promise.resolve(null),
    listReviews(bookId),
    getEditorialIssues(bookId),
    getRevisionCandidates(bookId),
    getAuthorEditResponses(bookId),
    listManuscriptVersions(bookId, meta.current_version_id),
  ]);

  const currentVersion = versions.find((v) => v.isCurrent);
  const openIssues = issues.filter((i) => i.resolution_status !== "resolved");
  const accepted = countAcceptedRevisions(responses);

  const reviewSummaries: StudioReviewSummary[] = reviews.map((r) =>
    Object.freeze({
      id: r.id,
      perspective: r.perspective,
      lifecycleStatus: r.lifecycle_status ?? null,
      createdAt: r.created_at,
    }),
  );

  return Object.freeze({
    id: meta.id,
    title: meta.title,
    seriesName: series?.title ?? null,
    volumeNumber: meta.series_order ?? null,
    activeVersionId: meta.current_version_id ?? null,
    activeVersionLabel: currentVersion?.label ?? null,
    activeVersionNumber: currentVersion?.versionNumber ?? null,
    wordCount: ctx?.wordCount ?? meta.word_count ?? null,
    versions: Object.freeze(versions),
    reviews: Object.freeze(reviewSummaries),
    openIssueCount: openIssues.length,
    acceptedRevisionCount: accepted,
    openActionItemCount: candidates.filter((c) => c.status !== "applied" && c.status !== "rejected").length,
  });
}
