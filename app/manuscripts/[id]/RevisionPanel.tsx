"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  uploadRevision,
  recheckRevision,
  type UploadRevisionState,
} from "@/app/actions/revisions";
import type { Provider } from "@/lib/types";

const initialUpload: UploadRevisionState = { ok: false };

export default function RevisionPanel({
  manuscriptId,
  outstandingIssues,
}: {
  manuscriptId: string;
  outstandingIssues: { id: string; title: string }[];
}) {
  const [upState, upAction, upPending] = useActionState(uploadRevision, initialUpload);
  const formRef = useRef<HTMLFormElement>(null);
  const [recheckPending, startRecheck] = useTransition();
  const [recheckMsg, setRecheckMsg] = useState<string | null>(null);
  const [recheckErrors, setRecheckErrors] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(outstandingIssues.map((i) => i.id)),
  );

  useEffect(() => {
    if (upState.ok) formRef.current?.reset();
  }, [upState.ok]);

  const hasIssues = outstandingIssues.length > 0;
  const noneSelected = hasIssues && selected.size === 0;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function recheck(providers: Provider[]) {
    setRecheckMsg(null);
    setRecheckErrors([]);
    startRecheck(async () => {
      const results = await Promise.all(
        providers.map((p) => recheckRevision(manuscriptId, p, Array.from(selected))),
      );
      const msgs = results.filter((r) => r.ok).map((r) => r.message).filter(Boolean) as string[];
      const errs = results.flatMap((r) => r.errors ?? []);
      setRecheckMsg(msgs.length ? msgs.join(" · ") : null);
      setRecheckErrors(errs);
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-black/10 bg-paper p-5 dark:border-white/15 dark:bg-white/5">
      <form ref={formRef} action={upAction} className="space-y-2">
        <input type="hidden" name="manuscriptId" value={manuscriptId} />
        <label htmlFor="revision-file" className="block text-sm font-medium">
          Upload a revised version (.docx)
        </label>
        <p className="text-xs text-black/55 dark:text-white/55">
          Replaces this manuscript’s text — your issues stay attached. Upload the full revised
          document (it overwrites the whole text, it doesn’t merge). Then re-check below.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            id="revision-file"
            name="file"
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            required
            className="block text-sm file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-500/20 dark:file:text-indigo-200"
          />
          <button
            type="submit"
            disabled={upPending}
            className="rounded-md bg-black/[.08] px-3 py-1.5 text-sm font-medium hover:bg-black/[.12] disabled:opacity-60 dark:bg-white/10 dark:hover:bg-white/15"
          >
            {upPending ? "Uploading…" : "Upload revision"}
          </button>
        </div>
        {upState.error && <p className="text-sm text-red-600">{upState.error}</p>}
        {upState.ok && upState.message && (
          <p className="text-sm text-green-600">{upState.message}</p>
        )}
      </form>

      <div className="space-y-3 border-t border-black/10 pt-4 dark:border-white/10">
        {hasIssues ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">
                Issues to re-check{" "}
                <span className="font-normal text-black/50 dark:text-white/50">
                  ({selected.size} of {outstandingIssues.length} selected)
                </span>
              </span>
              <span className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setSelected(new Set(outstandingIssues.map((i) => i.id)))}
                  className="text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  Clear
                </button>
              </span>
            </div>
            <ul className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-black/10 p-2 dark:border-white/10">
              {outstandingIssues.map((issue) => (
                <li key={issue.id}>
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.has(issue.id)}
                      onChange={() => toggle(issue.id)}
                      className="mt-0.5 size-4 shrink-0 cursor-pointer accent-indigo-600"
                    />
                    <span>{issue.title}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-black/55 dark:text-white/55">
            No outstanding issues — a re-check will just re-grade the revised draft.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-black/60 dark:text-white/60">Re-check &amp; re-score:</span>
          <button
            type="button"
            onClick={() => recheck(["openai"])}
            disabled={recheckPending || noneSelected}
            className="rounded border border-emerald-600/60 px-2.5 py-1 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
          >
            OpenAI
          </button>
          <button
            type="button"
            onClick={() => recheck(["anthropic"])}
            disabled={recheckPending || noneSelected}
            className="rounded border border-indigo-600/60 px-2.5 py-1 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
          >
            Claude
          </button>
          <button
            type="button"
            onClick={() => recheck(["openai", "anthropic"])}
            disabled={recheckPending || noneSelected}
            className="rounded-md bg-accent px-2.5 py-1 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            Both
          </button>
          {recheckPending && (
            <span className="text-xs text-black/50 dark:text-white/50">
              Re-reading the full manuscript — this can take a minute.
            </span>
          )}
          {noneSelected && (
            <span className="text-xs text-amber-600">Select at least one issue.</span>
          )}
        </div>
        {recheckMsg && <p className="text-sm text-green-600">{recheckMsg}</p>}
        {recheckErrors.length > 0 && (
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-red-600">
            {recheckErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
