"use client";

import { useState, useTransition } from "react";
import { generateReviews } from "@/app/actions/reviews";
import type { Provider } from "@/lib/types";

export default function GenerateReviewsButton({
  manuscriptId,
  hasCommercial,
  hasCraft,
}: {
  manuscriptId: string;
  hasCommercial: boolean;
  hasCraft: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<string[]>([]);
  const [running, setRunning] = useState<Provider[] | null>(null);

  function run(providers: Provider[]) {
    setErrors([]);
    setRunning(providers);
    startTransition(async () => {
      const result = await generateReviews(manuscriptId, providers);
      setErrors(result.errors ?? []);
      setRunning(null);
    });
  }

  const label = (provider: Provider, has: boolean) =>
    pending && running?.length === 1 && running[0] === provider
      ? "…"
      : has
        ? "Regenerate"
        : "Generate";

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-black/50 dark:text-white/50">Reviews:</span>
        <button
          type="button"
          onClick={() => run(["openai"])}
          disabled={pending}
          className="rounded-md border border-emerald-600/60 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
        >
          {label("openai", hasCommercial)} Literary Agent
        </button>
        <button
          type="button"
          onClick={() => run(["anthropic"])}
          disabled={pending}
          className="rounded-md border border-indigo-600/60 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-indigo-300 dark:hover:bg-accent-hover/10"
        >
          {label("anthropic", hasCraft)} Claude
        </button>
        <button
          type="button"
          onClick={() => run(["openai", "anthropic"])}
          disabled={pending}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending && running?.length === 2 ? "Generating…" : "Both"}
        </button>
      </div>
      {pending && (
        <span className="text-xs text-black/50 dark:text-white/50">
          Reading the full manuscript — this can take a minute.
        </span>
      )}
      {errors.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-right text-sm text-red-600">
          {errors.map((e, i) => (
            <li key={i} className="text-left">{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
