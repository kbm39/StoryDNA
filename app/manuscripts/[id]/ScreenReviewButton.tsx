"use client";

import { useState, useTransition } from "react";
import { generateScreenReviews } from "@/app/actions/reviews";
import type { Provider } from "@/lib/types";

export default function ScreenReviewButton({
  manuscriptId,
  hasOpenAI,
  hasClaude,
}: {
  manuscriptId: string;
  hasOpenAI: boolean;
  hasClaude: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<string[]>([]);
  const [running, setRunning] = useState<Provider[] | null>(null);

  function run(providers: Provider[]) {
    setErrors([]);
    setRunning(providers);
    startTransition(async () => {
      const result = await generateScreenReviews(manuscriptId, providers);
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
        <span className="text-xs text-black/50 dark:text-white/50">Producer’s read:</span>
        <button
          type="button"
          onClick={() => run(["openai"])}
          disabled={pending}
          className="rounded-md border border-emerald-600/60 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
        >
          {label("openai", hasOpenAI)} OpenAI
        </button>
        <button
          type="button"
          onClick={() => run(["anthropic"])}
          disabled={pending}
          className="rounded-md border border-indigo-600/60 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-60 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
        >
          {label("anthropic", hasClaude)} Claude
        </button>
        <button
          type="button"
          onClick={() => run(["openai", "anthropic"])}
          disabled={pending}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {pending && running?.length === 2 ? "Generating…" : "Both"}
        </button>
      </div>
      {pending && (
        <span className="text-xs text-black/50 dark:text-white/50">
          Reading the manuscript as a producer — up to a minute.
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
