import Link from "next/link";
import { groupCandidatesByIssue } from "@/lib/agent-revisions";
import { suggestedEditsHref } from "@/lib/author-response-status";
import type { EditorialIssue, RevisionCandidate } from "@/lib/types";
import CandidateStatusControl from "./CandidateStatusControl";

const SEVERITY_CLS: Record<string, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200",
  low: "bg-black/[.06] text-black/60 dark:bg-white/10 dark:text-white/60",
};

function Chip({ children, cls }: { children: React.ReactNode; cls?: string }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
        cls ?? "bg-black/[.06] text-black/60 dark:bg-white/10 dark:text-white/60"
      }`}
    >
      {children}
    </span>
  );
}

function Candidate({ c, manuscriptId }: { c: RevisionCandidate; manuscriptId: string }) {
  return (
    <div className="rounded-md border border-black/10 bg-black/[.02] p-3 text-xs dark:border-white/10 dark:bg-white/[.03]">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <Chip cls="bg-accent/15 text-accent">{c.type.replace(/_/g, " ")}</Chip>
        <Chip>{c.export_mode === "comment" ? "comment" : "track change"}</Chip>
        {c.verified ? (
          <Chip cls="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
            ✓ passage located
          </Chip>
        ) : (
          <Chip cls="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300">
            ⚠ passage not located
          </Chip>
        )}
        {c.locator && <span className="text-black/45 dark:text-white/45">{c.locator}</span>}
      </div>

      <p className="border-l-2 border-red-300/60 pl-2 text-black/70 line-through dark:text-white/60">
        {c.original}
      </p>
      {c.revised && (
        <p className="mt-1 border-l-2 border-emerald-400/60 pl-2 text-black/80 dark:text-white/80">
          {c.revised}
        </p>
      )}

      {c.reason && <p className="mt-2 text-black/70 dark:text-white/70">{c.reason}</p>}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {c.word_savings != null && c.word_savings > 0 && <Chip>−{c.word_savings} words</Chip>}
        {c.confidence != null && <Chip>{c.confidence}% confidence</Chip>}
        {c.difficulty && <Chip>{c.difficulty.replace(/_/g, " ")}</Chip>}
        {c.story_risk && <Chip>story risk: {c.story_risk}</Chip>}
        {c.voice_risk && <Chip>voice risk: {c.voice_risk}</Chip>}
        {c.commercial_impact && <Chip>commercial: {c.commercial_impact}</Chip>}
        {c.reader_impact && <Chip>reader: {c.reader_impact}</Chip>}
        {c.grade_delta != null && c.grade_delta > 0 && (
          <Chip cls="bg-accent/15 text-accent">grade +{c.grade_delta}</Chip>
        )}
      </div>

      {c.consequence_if_unchanged && (
        <p className="mt-2 text-[11px] italic text-black/45 dark:text-white/45">
          If unchanged: {c.consequence_if_unchanged}
        </p>
      )}
      {c.dependencies && (
        <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">⚠ {c.dependencies}</p>
      )}

      <CandidateStatusControl
        candidateId={c.id}
        manuscriptId={manuscriptId}
        status={c.status}
        verified={c.verified}
      />
    </div>
  );
}

/**
 * Manuscript-page view of generated Editorial Issues and Revision Candidates.
 * Editorial lifecycle controls update revision_candidates.status only.
 * Author accept/reject/modify/skip lives in Suggested Edits (author_edit_responses).
 */
export default function RevisionCandidatesPreview({
  issues,
  candidates,
  manuscriptId,
}: {
  issues: EditorialIssue[];
  candidates: RevisionCandidate[];
  manuscriptId: string;
}) {
  const byIssue = groupCandidatesByIssue(candidates);
  const verifiedCount = candidates.filter((c) => c.verified).length;

  return (
    <div className="mt-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Editorial Issues &amp; Revision Candidates</h3>
        <Link
          href={suggestedEditsHref(manuscriptId)}
          className="rounded-md border border-accent/40 px-3 py-1.5 text-sm font-semibold text-accent transition hover:bg-accent/5"
        >
          Open Suggested Edits →
        </Link>
      </div>
      <p className="mb-2 text-sm text-black/55 dark:text-white/55">
        The Literary Agent’s criticisms, turned into trackable issues and grounded revision
        candidates. Use <strong>editorial lifecycle</strong> controls here to prepare candidates
        for export. Record your own <strong>author decisions</strong> separately in Suggested
        Edits — those do not change editorial status automatically.
      </p>
      <p className="mb-4 text-xs text-black/45 dark:text-white/45">
        {candidates.length} candidate{candidates.length === 1 ? "" : "s"} · {verifiedCount}{" "}
        with located passages · Word redline export coming in a later milestone
      </p>

      <ul className="space-y-4">
        {issues.map((issue) => {
          const cands = byIssue.get(issue.id) ?? [];
          return (
            <li
              key={issue.id}
              className="rounded-xl border border-black/10 bg-paper p-4 shadow-sm dark:border-white/15 dark:bg-white/5"
            >
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                {issue.severity && (
                  <Chip cls={SEVERITY_CLS[issue.severity] ?? SEVERITY_CLS.low}>{issue.severity}</Chip>
                )}
                {issue.area && <Chip>{issue.area}</Chip>}
                <Chip>{issue.resolution_status}</Chip>
                <span className="text-[11px] text-black/40 dark:text-white/40">
                  owner: {issue.owning_reviewer}
                </span>
              </div>
              <p className="font-medium">{issue.text}</p>
              {issue.success_criterion && (
                <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                  <span className="font-medium">Fixed =</span>{" "}
                  <span className="italic">{issue.success_criterion}</span>
                </p>
              )}

              {cands.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {cands.map((c) => (
                    <Candidate key={c.id} c={c} manuscriptId={manuscriptId} />
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs italic text-black/45 dark:text-white/45">
                  Guidance-only — no direct edit proposed.
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
