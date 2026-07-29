import Link from "next/link";
import { notFound } from "next/navigation";
import { MilitaryExpertAuthorReviewPanel } from "@/app/studio/books/[bookId]/experts/MilitaryExpertAuthorReviewPanel.tsx";
import { StudioNav } from "@/app/studio/components/StudioShell.tsx";
import { getStudioBookWorkspace } from "@/lib/studio/book-workspace.ts";
import { loadMilitaryExpertReportDisplayModel } from "@/lib/studio/military-expert-draft-review-view.ts";

function FindingList({
  title,
  findings,
}: {
  title: string;
  findings: readonly {
    finding_id: string;
    category: string;
    severity: string;
    realism_status: string;
    confidence: string;
  }[];
}) {
  if (findings.length === 0) return null;

  return (
    <section className="rounded-xl border border-black/10 bg-paper p-5 dark:border-white/10">
      <h3 className="font-serif text-lg font-semibold">{title}</h3>
      <ul className="mt-4 space-y-3">
        {findings.map((finding) => (
          <li
            key={finding.finding_id}
            className="rounded-lg border border-black/10 p-4 text-sm dark:border-white/10"
          >
            <p className="font-medium">{finding.finding_id}</p>
            <dl className="mt-2 grid gap-1 text-xs text-black/60 dark:text-white/60 sm:grid-cols-2">
              <div>
                <dt className="inline font-medium">Category: </dt>
                <dd className="inline">{finding.category.replace(/_/g, " ")}</dd>
              </div>
              <div>
                <dt className="inline font-medium">Severity: </dt>
                <dd className="inline">{finding.severity}</dd>
              </div>
              <div>
                <dt className="inline font-medium">Realism: </dt>
                <dd className="inline">{finding.realism_status.replace(/_/g, " ")}</dd>
              </div>
              <div>
                <dt className="inline font-medium">Confidence: </dt>
                <dd className="inline">{finding.confidence}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}

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

      <section className="rounded-xl border border-black/10 bg-paper p-5 dark:border-white/10">
        <h3 className="font-serif text-lg font-semibold">Summary</h3>
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
            <dt className="text-black/50 dark:text-white/50">Confirmed issues</dt>
            <dd className="font-medium">{report.scoreSummary.confirmedIssueCount}</dd>
          </div>
          <div>
            <dt className="text-black/50 dark:text-white/50">Author review required</dt>
            <dd className="font-medium">{report.scoreSummary.authorReviewRequiredCount}</dd>
          </div>
          <div>
            <dt className="text-black/50 dark:text-white/50">Completed</dt>
            <dd className="font-medium">{new Date(report.createdAt).toLocaleString()}</dd>
          </div>
        </dl>
      </section>

      <FindingList title="Confirmed Findings" findings={report.confirmedFindings} />

      <MilitaryExpertAuthorReviewPanel items={report.authorReviewRequiredItems} />

      <CandidateList
        title="Investigation Candidates"
        description="Findings that need author investigation before revising."
        candidates={report.investigationCandidates}
      />

      <CandidateList
        title="Revision Candidates"
        description="Validated findings that may warrant manuscript revision."
        candidates={report.revisionCandidates}
      />
    </section>
  );
}
