import Link from "next/link";
import { notFound } from "next/navigation";
import { MilitaryExpertAuthorReviewPanel } from "@/app/studio/books/[bookId]/experts/MilitaryExpertAuthorReviewPanel.tsx";
import { MilitaryExpertConfirmedFindingCard } from "@/app/studio/books/[bookId]/experts/MilitaryExpertFindingCard.tsx";
import { MilitaryExpertReportExportLinks } from "@/app/studio/books/[bookId]/experts/MilitaryExpertReportExportLinks.tsx";
import { StudioNav } from "@/app/studio/components/StudioShell.tsx";
import { getStudioBookWorkspace } from "@/lib/studio/book-workspace.ts";
import {
  MILITARY_EXPERT_CONCERNS_REQUIRING_ATTENTION_LABEL,
  MILITARY_EXPERT_FULLY_VALIDATED_FINDINGS_HEADING,
  MILITARY_EXPERT_NEED_YOUR_REVIEW_LABEL,
  MILITARY_EXPERT_REVISION_BOARD_UNAVAILABLE,
} from "@/lib/studio/military-expert-display.ts";
import { loadMilitaryExpertReportDisplayModel } from "@/lib/studio/military-expert-draft-review-view.ts";

function CandidateList({
  title,
  description,
  candidates,
}: {
  title: string;
  description: string;
  candidates: readonly { findingId: string; title: string; taskLanguage: string }[];
}) {
  if (candidates.length === 0) return null;

  return (
    <section className="rounded-xl border border-black/10 bg-paper p-5 dark:border-white/10">
      <h3 className="font-serif text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-black/55 dark:text-white/55">{description}</p>
      <ul className="mt-4 space-y-3">
        {candidates.map((candidate) => (
          <li
            key={candidate.findingId}
            className="rounded-lg border border-black/10 p-4 text-sm dark:border-white/10"
          >
            <p className="font-medium">{candidate.title}</p>
            <p className="mt-1 text-black/65 dark:text-white/65">{candidate.taskLanguage}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function MilitaryExpertReportPage({
  params,
}: {
  params: Promise<{ bookId: string; reviewId: string }>;
}) {
  const { bookId, reviewId } = await params;
  const workspace = await getStudioBookWorkspace(bookId);
  if (!workspace) notFound();

  const report = await loadMilitaryExpertReportDisplayModel(reviewId, bookId);
  if (!report) notFound();

  return (
    <section className="space-y-6">
      <StudioNav bookId={bookId} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/studio/books/${bookId}/experts`}
            className="text-sm text-accent hover:underline"
          >
            ← Back to Expert Desk
          </Link>
          <h2 className="mt-3 font-serif text-2xl font-semibold">Military Expert Report</h2>
          <p className="mt-1 text-sm text-black/55 dark:text-white/55">
            {workspace.title} — {report.completedReportStatusLabel}
          </p>
        </div>
        <MilitaryExpertReportExportLinks bookId={bookId} reviewId={reviewId} />
      </div>

      {report.isProvisional ? (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
          role="status"
        >
          <p className="font-semibold">Provisional release</p>
          <p className="mt-1">
            This review was released provisionally because StoryDNA could not complete its
            confidence check on every finding. Findings marked Author Review Required should not be
            treated as confirmed until you review them.
          </p>
        </div>
      ) : null}

      {report.v2Report ? (
        <section className="rounded-xl border border-black/10 bg-paper p-5 dark:border-white/10">
          <h3 className="font-serif text-lg font-semibold">Review Scope</h3>
          <p className="mt-2 text-sm text-black/70 dark:text-white/70">{report.v2Report.scopeBlock}</p>
          <p className="mt-3 text-sm">{report.v2Report.overallAssessment}</p>
          {report.v2Report.recurringStrengths.length > 0 ? (
            <div className="mt-4">
              <h4 className="text-sm font-medium">What the manuscript does well</h4>
              <ul className="mt-2 list-disc pl-5 text-sm">
                {report.v2Report.recurringStrengths.map((s) => (
                  <li key={s.title}>{s.title}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {report.v2Report.topRevisionPriorities.length > 0 ? (
            <div className="mt-4">
              <h4 className="text-sm font-medium">Top revision priorities</h4>
              <ol className="mt-2 list-decimal pl-5 text-sm">
                {report.v2Report.topRevisionPriorities.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ol>
            </div>
          ) : null}
        </section>
      ) : null}

      {report.legacyContentOnly ? (
        <div
          className="rounded-xl border border-black/10 bg-paper p-4 text-sm text-black/65 dark:border-white/10 dark:text-white/65"
          role="note"
        >
          This review was saved before full finding content persistence was enabled. Structural
          summaries and honest placeholders are shown where original prose was not stored.
        </div>
      ) : null}

      <section className="rounded-xl border border-black/10 bg-paper p-5 dark:border-white/10">
        <h3 className="font-serif text-lg font-semibold">Summary</h3>
        {report.countExplanation ? (
          <p className="mt-2 text-sm text-black/60 dark:text-white/60">{report.countExplanation}</p>
        ) : null}
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-black/50 dark:text-white/50">Review status</dt>
            <dd className="font-medium">{report.reviewStatus.replace(/_/g, " ")}</dd>
          </div>
          <div>
            <dt className="text-black/50 dark:text-white/50">Generation</dt>
            <dd className="font-medium">{report.generationStatus.replace(/_/g, " ")}</dd>
          </div>
          <div>
            <dt className="text-black/50 dark:text-white/50">
              {MILITARY_EXPERT_CONCERNS_REQUIRING_ATTENTION_LABEL}
            </dt>
            <dd className="font-medium">{report.scoreSummary.confirmedIssueCount}</dd>
          </div>
          <div>
            <dt className="text-black/50 dark:text-white/50">
              {MILITARY_EXPERT_NEED_YOUR_REVIEW_LABEL}
            </dt>
            <dd className="font-medium">{report.scoreSummary.authorReviewRequiredCount}</dd>
          </div>
          <div>
            <dt className="text-black/50 dark:text-white/50">Completed</dt>
            <dd className="font-medium">{new Date(report.createdAt).toLocaleString()}</dd>
          </div>
        </dl>
      </section>

      {report.confirmedFindingItems.length > 0 ? (
        <section className="rounded-xl border border-black/10 bg-paper p-5 dark:border-white/10">
          <h3 className="font-serif text-lg font-semibold">
            {MILITARY_EXPERT_FULLY_VALIDATED_FINDINGS_HEADING}
          </h3>
          <p className="mt-1 text-sm text-black/55 dark:text-white/55">
            Every finding StoryDNA finished checking, excluding items still waiting for your review.
          </p>
          <ul className="mt-4 space-y-3">
            {report.confirmedFindingItems.map((item) => (
              <MilitaryExpertConfirmedFindingCard key={item.findingId} item={item} />
            ))}
          </ul>
        </section>
      ) : null}

      <MilitaryExpertAuthorReviewPanel items={report.authorReviewRequiredItems} />

      <div
        className="rounded-xl border border-black/10 bg-paper p-4 text-sm text-black/65 dark:border-white/10 dark:text-white/65"
        role="note"
      >
        {MILITARY_EXPERT_REVISION_BOARD_UNAVAILABLE}
      </div>

      <CandidateList
        title="Investigation Candidates"
        description="Findings that need your review before revising. Shown here for reference only."
        candidates={report.investigationCandidates}
      />

      <CandidateList
        title="Revision Candidates"
        description="Validated findings that may warrant manuscript revision. Shown here for reference only."
        candidates={report.revisionCandidates}
      />

      {report.v2Report ? (
        <>
          <section className="rounded-xl border border-black/10 bg-paper p-5 dark:border-white/10">
            <h3 className="font-serif text-lg font-semibold">Complete Scene Inventory</h3>
            <ul className="mt-3 space-y-1 text-sm">
              {report.v2Report.sceneInventory.map((entry) => (
                <li key={entry.sceneId} className="flex justify-between gap-2">
                  <span>{entry.sceneId}</span>
                  <span className="text-black/55 dark:text-white/55">
                    {entry.status.replace(/_/g, " ")}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-black/10 bg-paper p-5 dark:border-white/10">
            <h3 className="font-serif text-lg font-semibold">Scene-by-Scene Appendix</h3>
            <div className="mt-4 space-y-4">
              {report.v2Report.sceneAppendix.map((scene) => (
                <article
                  key={scene.sceneId}
                  className="rounded-lg border border-black/10 p-4 dark:border-white/10"
                >
                  <h4 className="font-medium">
                    {scene.sceneId} · {scene.locator}
                  </h4>
                  <p className="text-xs text-black/55 dark:text-white/55">
                    {scene.sceneTypes.join(", ")} · {scene.status}
                  </p>
                  {scene.realismSummary ? (
                    <p className="mt-2 text-sm">{scene.realismSummary}</p>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </section>
  );
}
