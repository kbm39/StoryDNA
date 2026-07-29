import { notFound } from "next/navigation";
import { getExpertCatalogEntry, type ExpertCatalogKey } from "@/lib/expert-catalog.ts";
import { getStudioBookWorkspace } from "@/lib/studio/book-workspace.ts";
import { listStudioExpertDeskEntries } from "@/lib/studio/expert-desk.ts";
import { buildStudioExecutionPolicy } from "@/lib/studio/execution-policy.ts";
import { classifyExpertExecution } from "@/lib/studio/expert-classification.ts";
import { getStudioExpertDeskContext } from "@/lib/studio/review-dashboard.ts";
import type { StudioEditorialTeamMember } from "@/lib/studio/types.ts";
import { StudioNav } from "../../../components/StudioShell.tsx";
import { EditorialTeamClient } from "./EditorialTeamClient.tsx";

function catalogForKey(key: string) {
  if (
    key === "literary_agent" ||
    key === "developmental_editor" ||
    key === "line_editor" ||
    key === "psychologist" ||
    key === "librarian" ||
    key === "military_expert"
  ) {
    return getExpertCatalogEntry(key as ExpertCatalogKey);
  }
  return null;
}

function buildRecruitCandidate(key: string, manuscriptId: string): StudioEditorialTeamMember | null {
  const desk = listStudioExpertDeskEntries().find((e) => e.key === key);
  if (!desk) return null;
  const catalog = catalogForKey(key);
  return Object.freeze({
    manuscriptId,
    expertKey: key,
    displayName: desk.displayName,
    purpose: desk.purpose,
    executionClass: classifyExpertExecution(key),
    policy: buildStudioExecutionPolicy({
      expertKey: key,
      entry: catalog ?? null,
      privateUseAcknowledged: true,
    }),
    tier: desk.tier,
    tierLabel: desk.tierLabel,
    certificationStatus: desk.certificationStatus,
    expectedRuntime: desk.expectedRuntime,
    estimatedCost: desk.estimatedCost,
    ownerNotes: null,
    recruitedAt: new Date(0).toISOString(),
    runStatus: "waiting",
    lastReviewAt: null,
    latestReviewId: null,
    completedReportStatusLabel: null,
  });
}

export default async function StudioExpertDeskPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const workspace = await getStudioBookWorkspace(bookId);
  if (!workspace) notFound();

  const [context] = await Promise.all([
    getStudioExpertDeskContext(bookId),
  ]);

  const recruitedKeys = new Set(context.team.map((m) => m.expertKey));
  const availableExperts = listStudioExpertDeskEntries()
    .map((d) => buildRecruitCandidate(d.key, bookId))
    .filter((m): m is StudioEditorialTeamMember => m !== null && !recruitedKeys.has(m.expertKey));

  const versionLabel =
    workspace.activeVersionLabel ??
    (workspace.activeVersionNumber ? `v${workspace.activeVersionNumber}` : null);

  return (
    <section className="space-y-6">
      <StudioNav bookId={bookId} />
      <div>
        <h2 className="font-serif text-2xl font-semibold">Editorial Team</h2>
        <p className="mt-1 text-sm text-black/55 dark:text-white/55">
          Recruit experts, launch reviews, and monitor execution — all inside Studio.
        </p>
      </div>
      <EditorialTeamClient
        bookId={bookId}
        bookTitle={workspace.title}
        wordCount={workspace.wordCount}
        versionLabel={versionLabel}
        team={context.team}
        availableExperts={availableExperts}
        workflowProgress={context.workflowProgress}
        roundtable={context.roundtable}
        editorialHealth={context.editorialHealth}
      />
    </section>
  );
}
