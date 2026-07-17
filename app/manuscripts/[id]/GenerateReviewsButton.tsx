"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateReviews } from "@/app/actions/reviews";

export default function GenerateReviewsButton({
  manuscriptId,
  hasCraft,
  literaryAgentViaWorkflow,
}: {
  manuscriptId: string;
  hasCommercial: boolean;
  hasCraft: boolean;
  /** When true, Literary Agent must use Publishing Workflow — not this control. */
  literaryAgentViaWorkflow: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<string[]>([]);
  const [running, setRunning] = useState<"anthropic" | null>(null);

  function runCraft() {
    setErrors([]);
    setRunning("anthropic");
    startTransition(async () => {
      const craft = await generateReviews(manuscriptId, ["anthropic"]);
      const errs = craft.ok ? [] : [...(craft.errors ?? ["Craft review failed."])];
      setErrors(errs);
      setRunning(null);
      if (errs.length === 0) router.refresh();
    });
  }

  const craftLabel =
    pending && running === "anthropic" ? "…" : hasCraft ? "Regenerate" : "Generate";

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-black/50 dark:text-white/50">Reviews:</span>
        {literaryAgentViaWorkflow ? (
          <span
            className="rounded-md border border-black/10 px-3 py-1.5 text-sm text-black/45 dark:border-white/15 dark:text-white/45"
            title="Use the Literary Agent Publishing Workflow control below."
          >
            Literary Agent → Publishing Workflow
          </span>
        ) : (
          <span className="rounded-md border border-black/10 px-3 py-1.5 text-sm text-black/45 dark:border-white/15 dark:text-white/45">
            Literary Agent unavailable
          </span>
        )}
        <button
          type="button"
          onClick={runCraft}
          disabled={pending}
          className="rounded-md border border-indigo-600/60 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-indigo-300 dark:hover:bg-accent-hover/10"
        >
          {craftLabel} Claude
        </button>
      </div>
      {pending && running === "anthropic" && (
        <span className="text-xs text-black/50 dark:text-white/50">
          Reading the full manuscript — this can take a minute.
        </span>
      )}
      {errors.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-right text-sm text-red-600">
          {errors.map((e, i) => (
            <li key={i} className="text-left">
              {e}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
