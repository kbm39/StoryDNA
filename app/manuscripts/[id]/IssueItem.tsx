"use client";

import { useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import { setIssueStatus, deleteIssue } from "@/app/actions/issues";
import { requestSuggestions, deleteSuggestion } from "@/app/actions/suggestions";
import type { Issue, Provider, Suggestion } from "@/lib/types";
import ApplyEditControl from "./ApplyEditControl";

const SOURCE_LABEL: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Claude",
};

export default function IssueItem({
  issue,
  suggestions,
  manuscriptId,
}: {
  issue: Issue;
  suggestions: Suggestion[];
  manuscriptId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [reqPending, startReq] = useTransition();
  const [errors, setErrors] = useState<string[]>([]);
  const [open, setOpen] = useState(suggestions.length > 0);

  const resolved = issue.status === "resolved";
  const source = issue.source_provider ? SOURCE_LABEL[issue.source_provider] : "Manual";

  function toggle() {
    startTransition(async () => {
      await setIssueStatus(issue.id, manuscriptId, resolved ? "outstanding" : "resolved");
    });
  }

  function remove() {
    startTransition(async () => {
      await deleteIssue(issue.id, manuscriptId);
    });
  }

  function request(providers: Provider[]) {
    setErrors([]);
    setOpen(true);
    startReq(async () => {
      const result = await requestSuggestions(issue.id, manuscriptId, providers);
      setErrors(result.errors ?? []);
    });
  }

  function removeSuggestion(id: string) {
    startReq(async () => {
      await deleteSuggestion(id, manuscriptId);
    });
  }

  return (
    <li className={`px-4 py-3 ${pending ? "opacity-50" : ""}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={resolved}
          onChange={toggle}
          disabled={pending}
          className="mt-1 size-4 shrink-0 cursor-pointer accent-indigo-600"
          aria-label={resolved ? "Mark outstanding" : "Mark resolved"}
        />
        <div className="min-w-0 flex-1">
          <p className={`font-medium ${resolved ? "text-black/40 line-through dark:text-white/40" : ""}`}>
            {issue.title}
          </p>
          {issue.description && (
            <p className="mt-0.5 text-sm text-black/60 dark:text-white/60">{issue.description}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded bg-black/[.06] px-1.5 py-0.5 text-black/60 dark:bg-white/10 dark:text-white/60">
              {source}
            </span>
            {issue.category && (
              <span className="rounded bg-black/[.06] px-1.5 py-0.5 text-black/60 dark:bg-white/10 dark:text-white/60">
                {issue.category}
              </span>
            )}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="text-indigo-600 hover:underline dark:text-indigo-400"
            >
              {open ? "Hide" : suggestions.length > 0 ? `Suggestions (${suggestions.length})` : "Suggest fixes"}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="shrink-0 text-xs text-black/40 hover:text-red-600 disabled:opacity-50 dark:text-white/40"
          aria-label="Delete issue"
        >
          Delete
        </button>
      </div>

      {open && (
        <div className="mt-3 ml-7 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-black/50 dark:text-white/50">Request fixes from:</span>
            <button
              type="button"
              onClick={() => request(["openai"])}
              disabled={reqPending}
              className="rounded border border-emerald-600/60 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
            >
              OpenAI
            </button>
            <button
              type="button"
              onClick={() => request(["anthropic"])}
              disabled={reqPending}
              className="rounded border border-indigo-600/60 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
            >
              Claude
            </button>
            <button
              type="button"
              onClick={() => request(["openai", "anthropic"])}
              disabled={reqPending}
              className="rounded border border-black/20 px-2 py-1 text-xs font-medium hover:bg-black/[.04] disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
            >
              Both
            </button>
            {reqPending && (
              <span className="text-xs text-black/50 dark:text-white/50">Thinking…</span>
            )}
          </div>

          {errors.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-5 text-xs text-red-600">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}

          {suggestions.map((s) => (
            <div
              key={s.id}
              className="rounded-md border border-black/10 bg-black/[.02] p-3 dark:border-white/10 dark:bg-white/[.03]"
            >
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="font-medium">
                  {SOURCE_LABEL[s.provider] ?? s.provider}
                  {s.model ? ` · ${s.model}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => removeSuggestion(s.id)}
                  disabled={reqPending}
                  className="text-black/40 hover:text-red-600 disabled:opacity-50 dark:text-white/40"
                >
                  Delete
                </button>
              </div>
              <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-p:my-1.5">
                <ReactMarkdown>{s.content}</ReactMarkdown>
              </div>
              <ApplyEditControl
                suggestionId={s.id}
                manuscriptId={manuscriptId}
                applied={s.applied}
              />
            </div>
          ))}
        </div>
      )}
    </li>
  );
}
