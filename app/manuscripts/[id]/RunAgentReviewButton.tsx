"use client";

import { useState, useTransition } from "react";
import { runLiteraryAgentReview } from "@/app/actions/reviews";

/** Simple test trigger for the V2 Literary Agent Review (Review Engine). */
export default function RunAgentReviewButton({
  manuscriptId,
  hasReview,
}: {
  manuscriptId: string;
  hasReview: boolean;
}) {
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<string[]>([]);

  function run() {
    setErrors([]);
    start(async () => {
      const r = await runLiteraryAgentReview(manuscriptId);
      setErrors(r.errors ?? []);
    });
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-black/10 bg-paper p-3 dark:border-white/15 dark:bg-white/5">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Running…" : hasReview ? "Re-run Literary Agent Review" : "Run Literary Agent Review"}
      </button>
      <span className="text-xs text-black/55 dark:text-white/55">
        {pending
          ? "Reading the full manuscript under StoryDNA Constitution v1.0 — up to a minute."
          : "Runs the V2 acquisitions memo (full-text, evidence-backed) and shows it below."}
      </span>
      {errors.length > 0 && (
        <ul className="w-full list-disc space-y-0.5 pl-5 text-sm text-red-600">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
