"use client";

import { useState, useTransition } from "react";
import { runLiteraryAgentReview } from "@/app/actions/reviews";
import {
  generateAgentRevisions,
  getRevisionGenerationStatus,
  type RevisionGenerationStatus,
} from "@/app/actions/agent-revisions";

const BLOCKED_MSG = (count: number) =>
  `Cannot regenerate revision candidates: ${count} author response${
    count === 1 ? " has" : "s have"
  } already been recorded in Suggested Edits. Regenerating would invalidate those decisions. Complete or clear the author-review workflow first.`;

/** Runs the Literary Agent review, then generates linked revision candidates when allowed. */
export default function RunAgentReviewButton({
  manuscriptId,
  hasReview,
  generationStatus: initialStatus,
}: {
  manuscriptId: string;
  hasReview: boolean;
  generationStatus: RevisionGenerationStatus;
}) {
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "review" | "candidates">("idle");
  const [status, setStatus] = useState(initialStatus);

  const blockedByAuthorResponses = status.hasAuthorResponses;
  const willReplacePrior =
    !blockedByAuthorResponses &&
    (status.existingIssueCount > 0 || status.existingCandidateCount > 0);

  function run() {
    if (blockedByAuthorResponses) return;

    setErrors([]);
    setSuccess(null);
    start(async () => {
      const fresh = await getRevisionGenerationStatus(manuscriptId);
      setStatus(fresh);
      if (fresh.hasAuthorResponses) {
        setErrors([BLOCKED_MSG(fresh.authorResponseCount)]);
        setPhase("idle");
        return;
      }

      setPhase("review");
      const r = await runLiteraryAgentReview(manuscriptId);
      if (!r.ok) {
        setErrors(r.errors ?? []);
        setPhase("idle");
        return;
      }

      const recheck = await getRevisionGenerationStatus(manuscriptId);
      setStatus(recheck);
      if (recheck.hasAuthorResponses) {
        setErrors([BLOCKED_MSG(recheck.authorResponseCount)]);
        setPhase("idle");
        return;
      }

      setPhase("candidates");
      const c = await generateAgentRevisions(manuscriptId);
      setPhase("idle");
      if (!c.ok) {
        if (c.error) setErrors([c.error]);
        return;
      }

      const parts = [
        `Generated ${c.issues ?? 0} issue${c.issues === 1 ? "" : "s"} and ${c.candidates ?? 0} candidate${c.candidates === 1 ? "" : "s"}.`,
      ];
      if (c.replacedPriorGeneration) {
        parts.push("Prior generated issues and candidates were replaced.");
      }
      if (c.warnings?.length) {
        parts.push(c.warnings.join(" "));
      }
      setSuccess(parts.join(" "));
      setStatus(await getRevisionGenerationStatus(manuscriptId));
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
          : phase === "review"
            ? "Reading the full manuscript under StoryDNA Constitution v1.0 — up to a minute…"
            : phase === "candidates"
              ? "Turning the review's criticisms into revision candidates…"
              : willReplacePrior
                ? "Checks for author responses first, then runs the memo and atomically replaces prior generated issues and candidates."
                : "Checks for author responses first, then runs the memo and generates linked revision candidates below."}
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
