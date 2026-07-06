"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  uploadMarketabilityReport,
  summarizeMarketabilityReport,
  deleteMarketabilityReport,
  type UploadReportState,
} from "@/app/actions/marketability";
import type { Provider } from "@/lib/types";

const initialUpload: UploadReportState = { ok: false };

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function MarketabilityPanel({
  manuscriptId,
  hasReport,
  fileName,
  hasSummary,
  uploadedAt,
}: {
  manuscriptId: string;
  hasReport: boolean;
  fileName: string | null;
  hasSummary: boolean;
  uploadedAt: string | null;
}) {
  const [upState, upAction, upPending] = useActionState(uploadMarketabilityReport, initialUpload);
  const formRef = useRef<HTMLFormElement>(null);
  const [running, setRunning] = useState<Provider[]>([]);
  const [pending, start] = useTransition();
  const [delPending, startDelete] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (upState.ok) formRef.current?.reset();
  }, [upState.ok]);

  function summarize(providers: Provider[]) {
    setMsg(null);
    setError(null);
    setRunning(providers);
    start(async () => {
      const results = await Promise.all(
        providers.map((p) => summarizeMarketabilityReport(manuscriptId, p)),
      );
      const errs = results.filter((r) => !r.ok).map((r) => r.error ?? "failed");
      setError(errs.length ? errs.join(" · ") : null);
      if (errs.length < providers.length) setMsg("Summary updated.");
      setRunning([]);
    });
  }

  function remove() {
    if (!confirm("Remove the marketability report and its summary?")) return;
    startDelete(async () => {
      await deleteMarketabilityReport(manuscriptId);
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-black/10 bg-paper p-5 dark:border-white/15 dark:bg-white/5">
      <form ref={formRef} action={upAction} className="space-y-2">
        <input type="hidden" name="manuscriptId" value={manuscriptId} />
        <label htmlFor="report-file" className="block text-sm font-medium">
          {hasReport ? "Replace the marketability report" : "Upload a marketability report"}
        </label>
        <p className="text-xs text-black/55 dark:text-white/55">
          PDF, Word (.docx), or text (.txt) file — or paste the report text below. The AI summarizes
          its key components and key issues, and those feed into your query letters.
        </p>
        <input
          id="report-file"
          name="file"
          type="file"
          accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          className="block text-sm file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-500/20 dark:file:text-indigo-200"
        />
        <textarea
          name="text"
          rows={3}
          placeholder="…or paste the report text here"
          className="block w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent dark:border-white/20"
        />
        <button
          type="submit"
          disabled={upPending}
          className="rounded-md bg-black/[.08] px-3 py-1.5 text-sm font-medium hover:bg-black/[.12] disabled:opacity-60 dark:bg-white/10 dark:hover:bg-white/15"
        >
          {upPending ? "Saving…" : hasReport ? "Replace report" : "Save report"}
        </button>
        {upState.error && <p className="text-sm text-red-600">{upState.error}</p>}
        {upState.ok && upState.message && (
          <p className="text-sm text-green-600">{upState.message}</p>
        )}
      </form>

      {hasReport && (
        <div className="space-y-2 border-t border-black/10 pt-4 dark:border-white/10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-black/60 dark:text-white/60">
              {hasSummary ? "Re-summarize with:" : "Summarize with:"}
            </span>
            <button
              type="button"
              onClick={() => summarize(["openai"])}
              disabled={pending}
              className="rounded-md border border-emerald-600/60 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
            >
              {pending && running.length === 1 && running[0] === "openai" ? "Summarizing…" : "OpenAI"}
            </button>
            <button
              type="button"
              onClick={() => summarize(["anthropic"])}
              disabled={pending}
              className="rounded-md border border-indigo-600/60 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-60 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
            >
              {pending && running.length === 1 && running[0] === "anthropic" ? "Summarizing…" : "Claude"}
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
            <p className="text-xs text-black/50 dark:text-white/50">Reading the report…</p>
          )}
          {msg && <p className="text-sm text-green-600">{msg}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
