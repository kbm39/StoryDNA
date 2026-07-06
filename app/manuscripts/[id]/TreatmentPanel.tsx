"use client";

import { useState, useTransition } from "react";
import { generateTreatment } from "@/app/actions/treatments";
import type { Provider } from "@/lib/types";
import type { TreatmentFormat } from "@/lib/ai/shared";

const FORMATS: [TreatmentFormat, string][] = [
  ["limited_series", "Limited series"],
  ["ongoing_series", "Ongoing series"],
  ["feature", "Feature film"],
];

export default function TreatmentPanel({ manuscriptId }: { manuscriptId: string }) {
  const [format, setFormat] = useState<TreatmentFormat>("limited_series");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<Provider[]>([]);

  function run(providers: Provider[]) {
    setError(null);
    setRunning(providers);
    start(async () => {
      const results = await Promise.all(
        providers.map((p) => generateTreatment(manuscriptId, p, format)),
      );
      const errs = results.filter((r) => !r.ok).map((r) => r.error ?? "failed");
      setError(errs.length ? errs.join(" · ") : null);
      setRunning([]);
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-black/10 bg-paper p-5 dark:border-white/15 dark:bg-white/5">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="treatment-format" className="text-sm font-medium">
          Format:
        </label>
        <select
          id="treatment-format"
          value={format}
          onChange={(e) => setFormat(e.target.value as TreatmentFormat)}
          className="rounded-md border border-black/15 bg-transparent px-2 py-1 text-sm outline-none focus:border-accent dark:border-white/20"
        >
          {FORMATS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <span className="text-sm text-black/55 dark:text-white/55">· build with</span>
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
        Writes a pitch-ready treatment from the full manuscript — this can take a minute or two.
      </p>
      {pending && (
        <p className="text-xs text-black/50 dark:text-white/50">
          Reading the manuscript and writing the treatment…
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
