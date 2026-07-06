"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  uploadEditorialAnalysis,
  analyzeEditorialAnalysis,
  deleteEditorialAnalysis,
  type UploadAnalysisState,
} from "@/app/actions/editorial";
import type { Provider } from "@/lib/types";

const initialUpload: UploadAnalysisState = { ok: false };

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function EditorialPanel({
  manuscriptId,
  hasAnalysis,
  fileName,
  uploadedAt,
  hasComments,
}: {
  manuscriptId: string;
  hasAnalysis: boolean;
  fileName: string | null;
  uploadedAt: string | null;
  hasComments: boolean;
}) {
  const [upState, upAction, upPending] = useActionState(uploadEditorialAnalysis, initialUpload);
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [delPending, startDelete] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (upState.ok) formRef.current?.reset();
  }, [upState.ok]);

  function analyze(providers: Provider[]) {
    setMsg(null);
    setErrors([]);
    start(async () => {
      const r = await analyzeEditorialAnalysis(manuscriptId, providers);
      setErrors(r.errors ?? []);
      if (r.ok && r.message) setMsg(r.message);
    });
  }

  function remove() {
    if (!confirm("Remove the editorial analysis, its comments, verdicts, and suggestions?")) return;
    startDelete(async () => {
      await deleteEditorialAnalysis(manuscriptId);
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-black/10 bg-paper p-5 dark:border-white/15 dark:bg-white/5">
      <form ref={formRef} action={upAction} className="space-y-2">
        <input type="hidden" name="manuscriptId" value={manuscriptId} />
        <label htmlFor="analysis-file" className="block text-sm font-medium">
          {hasAnalysis ? "Replace the editorial analysis" : "Upload an editorial analysis"}
        </label>
        <p className="text-xs text-black/55 dark:text-white/55">
          PDF, Word (.docx), or text (.txt) — or paste it below. OpenAI and Claude each split it into
          comments and tell you which they agree or disagree with.
        </p>
        <input
          id="analysis-file"
          name="file"
          type="file"
          accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          className="block text-sm file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-500/20 dark:file:text-indigo-200"
        />
        <textarea
          name="text"
          rows={3}
          placeholder="…or paste the editorial analysis here"
          className="block w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent dark:border-white/20"
        />
        <button
          type="submit"
          disabled={upPending}
          className="rounded-md bg-black/[.08] px-3 py-1.5 text-sm font-medium hover:bg-black/[.12] disabled:opacity-60 dark:bg-white/10 dark:hover:bg-white/15"
        >
          {upPending ? "Saving…" : hasAnalysis ? "Replace analysis" : "Save analysis"}
        </button>
        {upState.error && <p className="text-sm text-red-600">{upState.error}</p>}
        {upState.ok && upState.message && (
          <p className="text-sm text-green-600">{upState.message}</p>
        )}
      </form>

      {hasAnalysis && (
        <div className="space-y-2 border-t border-black/10 pt-4 dark:border-white/10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-black/60 dark:text-white/60">
              {hasComments ? "Re-run verdicts with:" : "Analyze comments with:"}
            </span>
            <button
              type="button"
              onClick={() => analyze(["openai"])}
              disabled={pending}
              className="rounded-md border border-emerald-600/60 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
            >
              OpenAI
            </button>
            <button
              type="button"
              onClick={() => analyze(["anthropic"])}
              disabled={pending}
              className="rounded-md border border-indigo-600/60 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-60 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
            >
              Claude
            </button>
            <button
              type="button"
              onClick={() => analyze(["openai", "anthropic"])}
              disabled={pending}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
            >
              Both
            </button>
            <span className="ml-auto text-xs text-black/45 dark:text-white/45">
              {fileName ? `Source: ${fileName}` : ""}
              {uploadedAt ? ` · uploaded ${fmtDateTime(uploadedAt)}` : ""}
            </span>
            <button
              type="button"
              onClick={remove}
              disabled={delPending}
              className="text-xs text-red-600 hover:underline disabled:opacity-50"
            >
              {delPending ? "Removing…" : "Remove"}
            </button>
          </div>
          {pending && (
            <p className="text-xs text-black/50 dark:text-white/50">
              {hasComments
                ? "Re-reading your manuscript and re-judging each comment…"
                : "Splitting the analysis and judging each comment against your manuscript…"}
            </p>
          )}
          {msg && <p className="text-sm text-green-600">{msg}</p>}
          {errors.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-red-600">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
