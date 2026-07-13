"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getRevisionGenerationStatus,
  runFreshEditorialGeneration,
  type RevisionGenerationStatus,
} from "@/app/actions/agent-revisions";

const BLOCKED_MSG = (count: number) =>
  `Cannot regenerate: ${count} author response${
    count === 1 ? " has" : "s have"
  } already been recorded in Suggested Edits. Regenerating would invalidate those decisions. Complete or clear the author-review workflow first.`;

/** Runs the Literary Agent review and revision candidates in one atomic publish. */
export default function RunAgentReviewButton({
  manuscriptId,
  hasReview,
  generationStatus: initialStatus,
}: {
  manuscriptId: string;
  hasReview: boolean;
  generationStatus: RevisionGenerationStatus;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState(initialStatus);

  const blockedByAuthorResponses = status.hasAuthorResponses;
  const willReplacePrior =
    !blockedByAuthorResponses &&
    (hasReview || status.existingIssueCount > 0 || status.existingCandidateCount > 0);

  function run() {
    if (blockedByAuthorResponses) return;

    setErrors([]);
    setSuccess(null);
    start(async () => {
      const fresh = await getRevisionGenerationStatus(manuscriptId);
      setStatus(fresh);
      if (fresh.hasAuthorResponses) {
        setErrors([BLOCKED_MSG(fresh.authorResponseCount)]);
        setRunning(false);
        return;
      }

      setRunning(true);
      const result = await runFreshEditorialGeneration(manuscriptId);
      setRunning(false);

      if (!result.ok) {
        if (result.error) setErrors([result.error]);
        return;
      }

      const parts = [
        `Published new Literary Agent review with ${result.issueCount ?? 0} issue${
          result.issueCount === 1 ? "" : "s"
        } and ${result.candidateCount ?? 0} candidate${result.candidateCount === 1 ? "" : "s"}.`,
      ];
      if (result.oldReviewId) {
        parts.push("Prior review superseded; generated issues and candidates replaced.");
      }
      if (result.warnings?.length) {
        parts.push(result.warnings.join(" "));
      }
      setSuccess(parts.join(" "));
      setStatus(await getRevisionGenerationStatus(manuscriptId));
      router.refresh();
    });
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-black/10 bg-paper p-3 dark:border-white/15 dark:bg-white/5">
      <button
        type="button"
        onClick={run}
        disabled={pending || blockedByAuthorResponses}
        className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Running…" : hasReview ? "Re-run Literary Agent Review" : "Run Literary Agent Review"}
      </button>
      <span className="text-xs text-black/55 dark:text-white/55">
        {blockedByAuthorResponses
          ? `Regeneration blocked — ${status.authorResponseCount} author response${
              status.authorResponseCount === 1 ? " has" : "s have"
            } been recorded in Suggested Edits.`
          : running
            ? "Reading the full manuscript, generating revision candidates, then publishing atomically — up to several minutes…"
            : willReplacePrior
              ? "Checks for author responses first, then publishes a new memo and atomically replaces the prior review generation."
              : "Checks for author responses first, then publishes the memo and linked revision candidates."}
      </span>
      {blockedByAuthorResponses && (
        <p className="w-full text-sm text-amber-800 dark:text-amber-200">
          Author responses are preserved. The Literary Agent review will not start until Suggested
          Edits responses are cleared for this manuscript.
        </p>
      )}
      {success && (
        <p className="w-full text-sm text-emerald-700 dark:text-emerald-400" role="status">
          {success}
        </p>
      )}
      {errors.length > 0 && (
        <ul className="w-full list-disc space-y-0.5 pl-5 text-sm text-red-600 dark:text-red-400">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
