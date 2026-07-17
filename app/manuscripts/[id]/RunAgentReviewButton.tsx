"use client";

import { useState, useTransition } from "react";
import {
  getRevisionGenerationStatus,
  type RevisionGenerationStatus,
} from "@/app/actions/agent-revisions";
import {
  startLiteraryAgentPublishingWorkflow,
} from "@/app/actions/editorial-workflows";

const BLOCKED_MSG = (count: number) =>
  `Cannot regenerate: ${count} author response${
    count === 1 ? " has" : "s have"
  } already been recorded in Suggested Edits. Regenerating would invalidate those decisions. Complete or clear the author-review workflow first.`;

/** Starts a durable Publishing Workflow for Literary Agent review (non-blocking). */
export default function RunAgentReviewButton({
  manuscriptId,
  hasReview,
  generationStatus: initialStatus,
  workflowEnabled,
  hasActiveWorkflow,
  onWorkflowStarted,
}: {
  manuscriptId: string;
  hasReview: boolean;
  generationStatus: RevisionGenerationStatus;
  workflowEnabled: boolean;
  hasActiveWorkflow: boolean;
  onWorkflowStarted?: (workflowId: string) => void;
}) {
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState(initialStatus);

  const blockedByAuthorResponses = status.hasAuthorResponses;
  const willReplacePrior =
    !blockedByAuthorResponses &&
    (hasReview || status.existingIssueCount > 0 || status.existingCandidateCount > 0);

  function run() {
    if (blockedByAuthorResponses || !workflowEnabled || hasActiveWorkflow) return;

    setErrors([]);
    start(async () => {
      const fresh = await getRevisionGenerationStatus(manuscriptId);
      setStatus(fresh);
      if (fresh.hasAuthorResponses) {
        setErrors([BLOCKED_MSG(fresh.authorResponseCount)]);
        return;
      }

      const result = await startLiteraryAgentPublishingWorkflow(manuscriptId);
      if (!result.ok || !result.workflowId) {
        setErrors([result.error ?? "Could not start Publishing Workflow."]);
        return;
      }
      onWorkflowStarted?.(result.workflowId);
    });
  }

  if (!workflowEnabled) {
    return (
      <div className="mb-4 rounded-lg border border-black/10 bg-paper p-3 dark:border-white/15 dark:bg-white/5">
        <p className="text-sm font-medium text-black/80 dark:text-white/80">
          Literary Agent review is temporarily unavailable
        </p>
        <p className="mt-1 text-xs text-black/55 dark:text-white/55">
          Literary Agent reviews are temporarily unavailable while Publishing Workflow is being
          enabled. Full-manuscript generation will run in the background once enabled — not through
          a blocking browser request.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-black/10 bg-paper p-3 dark:border-white/15 dark:bg-white/5">
      <button
        type="button"
        onClick={run}
        disabled={pending || blockedByAuthorResponses || hasActiveWorkflow}
        className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending
          ? "Starting…"
          : hasActiveWorkflow
            ? "Publishing Workflow in progress"
            : hasReview
              ? "Re-run Literary Agent Review"
              : "Run Literary Agent Review"}
      </button>
      <span className="text-xs text-black/55 dark:text-white/55">
        {blockedByAuthorResponses
          ? `Regeneration blocked — ${status.authorResponseCount} author response${
              status.authorResponseCount === 1 ? " has" : "s have"
            } been recorded in Suggested Edits.`
          : hasActiveWorkflow
            ? "A Publishing Workflow is already running for this manuscript version."
            : willReplacePrior
              ? "Starts a Publishing Workflow, checks for author responses, then prepares your Literary Agent review in the background."
              : "Starts a Publishing Workflow. You may leave this page while StoryDNA works."}
      </span>
      {blockedByAuthorResponses && (
        <p className="w-full text-sm text-amber-800 dark:text-amber-200">
          Author responses are preserved. The Literary Agent review will not start until Suggested
          Edits responses are cleared for this manuscript.
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
