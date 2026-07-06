"use client";

import { useState, useTransition } from "react";
import { generateQueryLetter } from "@/app/actions/queries";
import type { Provider } from "@/lib/types";
import type { AgentOption } from "@/lib/agentfinder";

export default function QueryLetterPanel({
  manuscriptId,
  agents,
}: {
  manuscriptId: string;
  agents: AgentOption[];
}) {
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<Provider[]>([]);

  const selected = agents.find((a) => a.id === agentId);

  function run(providers: Provider[]) {
    if (!agentId) {
      setError("Pick an agent first.");
      return;
    }
    setError(null);
    setRunning(providers);
    start(async () => {
      const results = await Promise.all(
        providers.map((p) => generateQueryLetter(manuscriptId, agentId, p)),
      );
      const errs = results.filter((r) => !r.ok).map((r) => r.error ?? "failed");
      setError(errs.length ? errs.join(" · ") : null);
      setRunning([]);
    });
  }

  if (agents.length === 0) {
    return (
      <div className="rounded-lg border border-amber-300/70 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
        PKagentfinder isn’t connected (no agents loaded). Set
        <code className="mx-1 font-mono">AGENTFINDER_SUPABASE_URL</code>/
        <code className="mx-1 font-mono">AGENTFINDER_SUPABASE_KEY</code> and redeploy.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-black/10 bg-paper p-5 dark:border-white/15 dark:bg-white/5">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="agent" className="text-sm font-medium">
          Agent:
        </label>
        <select
          id="agent"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          className="max-w-full rounded-md border border-black/15 bg-transparent px-2 py-1 text-sm outline-none focus:border-accent dark:border-white/20"
        >
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.agency ? ` — ${a.agency}` : ""}
              {a.accepting === false ? " (closed)" : ""}
            </option>
          ))}
        </select>
        <span className="text-sm text-black/55 dark:text-white/55">· write with</span>
        <button
          type="button"
          onClick={() => run(["openai"])}
          disabled={pending}
          className="rounded-md border border-emerald-600/60 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
        >
          {pending && running.length === 1 && running[0] === "openai" ? "Writing…" : "OpenAI"}
        </button>
        <button
          type="button"
          onClick={() => run(["anthropic"])}
          disabled={pending}
          className="rounded-md border border-indigo-600/60 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-60 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
        >
          {pending && running.length === 1 && running[0] === "anthropic" ? "Writing…" : "Claude"}
        </button>
        <button
          type="button"
          onClick={() => run(["openai", "anthropic"])}
          disabled={pending}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {pending && running.length === 2 ? "Writing…" : "Both"}
        </button>
      </div>
      {selected && (
        <p className="text-xs text-black/55 dark:text-white/55">
          {selected.genres.length ? `Reps: ${selected.genres.join(", ")}` : ""}
          {selected.accepting === false ? " · not currently accepting submissions" : ""}
        </p>
      )}
      <p className="text-xs text-black/50 dark:text-white/50">
        Grounded strictly in your manuscript — it won’t invent plot, characters, comps, or bio.
        Comps and your author bio are left as <code className="font-mono">[bracketed placeholders]</code> for
        you to fill in. Tailored to the agent’s submission requirements.
      </p>
      {pending && (
        <p className="text-xs text-black/50 dark:text-white/50">Writing the query letter…</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
