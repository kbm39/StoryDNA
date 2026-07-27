import "server-only";
import { getEditorialIssues } from "@/lib/agent-revisions.ts";
import { listManuscripts } from "@/lib/manuscripts.ts";
import { getManuscriptMeta, listReviews } from "@/lib/reviews.ts";
import { getAuthorEditResponses } from "@/lib/suggested-edits.ts";
import { getSupabaseAdmin } from "@/lib/supabase/server.ts";
import { listSeries } from "@/lib/series.ts";
import type { StudioLibraryBook } from "./types.ts";

async function getCurrentVersionSummary(manuscriptId: string, currentVersionId: string | null) {
  if (!currentVersionId) return { label: null, versionNumber: null, updatedAt: null as string | null };
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("manuscript_versions")
    .select("label, version_number, created_at")
    .eq("id", currentVersionId)
    .maybeSingle();
  return {
    label: (data?.label as string | null) ?? null,
    versionNumber: (data?.version_number as number | null) ?? null,
    updatedAt: (data?.created_at as string | null) ?? null,
  };
}

function latestReviewStatus(reviews: Awaited<ReturnType<typeof listReviews>>): string | null {
  if (reviews.length === 0) return null;
  const sorted = [...reviews].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const latest = sorted[0]!;
  return latest.lifecycle_status ?? latest.perspective ?? "review";
}

export async function listStudioLibraryBooks(): Promise<readonly StudioLibraryBook[]> {
  const [manuscripts, seriesList] = await Promise.all([listManuscripts(), listSeries()]);
  const seriesById = new Map(seriesList.map((s) => [s.id, s]));

  const books = await Promise.all(
    manuscripts
      .filter((m) => !m.archived)
      .map(async (m) => {
        const meta = await getManuscriptMeta(m.id);
        const [reviews, issues, { responses }, version] = await Promise.all([
          listReviews(m.id),
          getEditorialIssues(m.id),
          getAuthorEditResponses(m.id),
          getCurrentVersionSummary(m.id, meta?.current_version_id ?? null),
        ]);
        const series = m.series_id ? seriesById.get(m.series_id) : undefined;
        const unresolved = issues.filter((i) => i.resolution_status !== "resolved").length;
        const accepted = responses.filter((r) => r.disposition === "accepted").length;

        return Object.freeze({
          id: m.id,
          title: m.title,
          seriesName: series?.title ?? null,
          volumeNumber: m.series_order ?? null,
          activeVersionLabel: version.label,
          activeVersionNumber: version.versionNumber,
          wordCount: meta?.word_count ?? m.word_count ?? null,
          lastUploadDate: version.updatedAt ?? m.updated_at ?? m.created_at,
          latestReviewStatus: latestReviewStatus(reviews),
          unresolvedIssueCount: unresolved,
          acceptedRevisionCount: accepted,
          status: m.status,
        });
      }),
  );

  return Object.freeze(books);
}
