"use client";

import { useState, useTransition } from "react";
import { generateManuscriptDeck, generateSeriesDeck } from "@/app/actions/decks";
import type { Provider } from "@/lib/types";

export default function PitchDeckPanel({
  scope,
  id,
}: {
  scope: "manuscript" | "series";
  id: string;
}) {
  const [pending, start] = useTransition();
  const [running, setRunning] = useState<Provider[]>([]);
  const [error, setError] = useState<string | null>(null);

  function run(providers: Provider[]) {
    setError(null);
    setRunning(providers);
    start(async () => {
      const results = await Promise.all(
        providers.map((p) =>
          scope === "series" ? generateSeriesDeck(id, p) : generateManuscriptDeck(id, p),
        ),
      );
      const errs = results.filter((r) => !r.ok).map((r) => r.error ?? "failed");
      setError(errs.length ? errs.join(" · ") : null);
      setRunning([]);
    });
  }

  return (
    <div className="space-y-2 rounded-lg border border-black/10 bg-paper p-5 dark:border-white/15 dark:bg-white/5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-black/60 dark:text-white/60">Build a pitch deck:</span>
        <button
          type="button"
          onClick={() => run(["openai"])}
          disabled={pending}
          className="rounded-md border border-emerald-600/60 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
        >
          {pending && running.length === 1 && running[0] === "openai" ? "Building…" : "OpenAI"}
        </button>
        <button
          type="button"
          onClick={() => run(["anthropic"])}
          disabled={pending}
          className="rounded-md border border-indigo-600/60 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-60 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
        >
          {pending && running.length === 1 && running[0] === "anthropic" ? "Building…" : "Claude"}
        </button>
        <button
          type="button"
          onClick={() => run(["openai", "anthropic"])}
          disabled={pending}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {pending && running.length === 2 ? "Building…" : "Both"}
        </button>
      </div>
      <p className="text-xs text-black/50 dark:text-white/50">
        {scope === "series"
          ? "Synthesized across every linked book (each book = a season). Exports to PowerPoint (.pptx)."
          : "Built from this book’s latest treatment if you have one (richer) — otherwise the manuscript. Exports to PowerPoint (.pptx)."}
      </p>
      {pending && <p className="text-xs text-black/50 dark:text-white/50">Designing slides…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
