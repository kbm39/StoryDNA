"use client";

import { useState, useTransition } from "react";
import { brainstorm } from "@/app/actions/brainstorms";
import type { Provider } from "@/lib/types";

export default function BrainstormForm({ manuscriptId }: { manuscriptId: string }) {
  const [scene, setScene] = useState("");
  const [useManuscript, setUseManuscript] = useState(false);
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<string[]>([]);

  function run(providers: Provider[]) {
    setErrors([]);
    start(async () => {
      const r = await brainstorm(manuscriptId, scene, providers, useManuscript);
      if (!r.ok) setErrors(r.errors ?? []);
    });
  }

  const disabled = pending || scene.trim() === "";

  return (
    <div className="space-y-3 rounded-lg border border-black/10 bg-paper p-5 dark:border-white/15 dark:bg-white/5">
      <label htmlFor="scene" className="block text-sm font-medium">
        Stuck on a scene? Describe it or the spot you’re stuck on.
      </label>
      <textarea
        id="scene"
        value={scene}
        onChange={(e) => setScene(e.target.value)}
        rows={3}
        placeholder="e.g. a detective working a crime scene who finds a key piece of evidence"
        className="w-full resize-y rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-white/20"
      />
      <label className="flex items-center gap-2 text-sm text-black/65 dark:text-white/65">
        <input
          type="checkbox"
          checked={useManuscript}
          onChange={(e) => setUseManuscript(e.target.checked)}
          className="size-4 accent-indigo-600"
        />
        Use my manuscript as context (ideas fit its world &amp; voice — slower, costs more)
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-black/60 dark:text-white/60">Ideas from:</span>
        <button
          type="button"
          onClick={() => run(["openai"])}
          disabled={disabled}
          className="rounded border border-emerald-600/60 px-2.5 py-1 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
        >
          OpenAI
        </button>
        <button
          type="button"
          onClick={() => run(["anthropic"])}
          disabled={disabled}
          className="rounded border border-indigo-600/60 px-2.5 py-1 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:text-indigo-300 dark:hover:bg-accent-hover/10"
        >
          Claude
        </button>
        <button
          type="button"
          onClick={() => run(["openai", "anthropic"])}
          disabled={disabled}
          className="rounded-md bg-accent px-3 py-1 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
        >
          Both
        </button>
        {pending && <span className="text-xs text-black/50 dark:text-white/50">Thinking…</span>}
      </div>
      {errors.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-red-600">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
