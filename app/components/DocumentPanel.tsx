"use client";

import { useState, useTransition } from "react";
import { generateDocument } from "@/app/actions/documents";
import type { Provider, DocType } from "@/lib/types";

export default function DocumentPanel({
  manuscriptId,
  docType,
  verb = "Generate",
}: {
  manuscriptId: string;
  docType: DocType;
  verb?: string;
}) {
  const [pending, start] = useTransition();
  const [running, setRunning] = useState<Provider[]>([]);
  const [error, setError] = useState<string | null>(null);

  function run(providers: Provider[]) {
    setError(null);
    setRunning(providers);
    start(async () => {
      const results = await Promise.all(
        providers.map((p) => generateDocument(manuscriptId, docType, p)),
      );
      const errs = results.filter((r) => !r.ok).map((r) => r.error ?? "failed");
      setError(errs.length ? errs.join(" · ") : null);
      setRunning([]);
    });
  }

  const busy = (p: Provider) => pending && running.length === 1 && running[0] === p;

  return (
    <div className="space-y-2 rounded-lg border border-black/10 bg-paper p-4 dark:border-white/15 dark:bg-white/5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-black/60 dark:text-white/60">{verb} with:</span>
        <button
          type="button"
          onClick={() => run(["openai"])}
          disabled={pending}
          className="rounded-md border border-emerald-600/60 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
        >
          {busy("openai") ? "Working…" : "OpenAI"}
        </button>
        <button
          type="button"
          onClick={() => run(["anthropic"])}
          disabled={pending}
          className="rounded-md border border-indigo-600/60 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-60 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
        >
          {busy("anthropic") ? "Working…" : "Claude"}
        </button>
        <button
          type="button"
          onClick={() => run(["openai", "anthropic"])}
          disabled={pending}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {pending && running.length === 2 ? "Working…" : "Both"}
        </button>
        {pending && (
          <span className="text-xs text-black/50 dark:text-white/50">
            Reading the manuscript — this can take a minute.
          </span>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
