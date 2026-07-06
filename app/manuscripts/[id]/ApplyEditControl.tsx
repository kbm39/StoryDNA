"use client";

import { useState, useTransition } from "react";
import {
  proposeEditsForSuggestion,
  applyEditsToManuscript,
} from "@/app/actions/edits";

type EditRow = { find: string; replace: string; accepted: boolean };

export default function ApplyEditControl({
  suggestionId,
  manuscriptId,
  applied,
}: {
  suggestionId: string;
  manuscriptId: string;
  applied: boolean;
}) {
  const [pending, start] = useTransition();
  const [phase, setPhase] = useState<"idle" | "review" | "done">("idle");
  const [edits, setEdits] = useState<EditRow[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ find: string; replace: string }[]>([]);
  const [appliedCount, setAppliedCount] = useState(0);

  const downloadHref = `/manuscripts/${manuscriptId}/download`;
  const acceptedCount = edits.filter((e) => e.accepted && e.find.trim()).length;

  function prepare() {
    setError(null);
    setFailed([]);
    start(async () => {
      const r = await proposeEditsForSuggestion(suggestionId, manuscriptId);
      if (!r.ok) {
        setError(r.error ?? "Could not prepare edits.");
        return;
      }
      setEdits((r.edits ?? []).map((e) => ({ ...e, accepted: true })));
      setNote(r.note ?? "");
      setPhase("review");
    });
  }

  function apply() {
    const chosen = edits
      .filter((e) => e.accepted && e.find.trim())
      .map(({ find, replace }) => ({ find, replace }));
    if (chosen.length === 0) return;
    setError(null);
    setFailed([]);
    start(async () => {
      const r = await applyEditsToManuscript(manuscriptId, suggestionId, chosen);
      if (!r.ok) {
        setError(r.error ?? "Apply failed.");
        setFailed(r.failed ?? []);
        return;
      }
      setAppliedCount(r.appliedCount ?? 0);
      setFailed(r.failed ?? []);
      setPhase("done");
    });
  }

  const patch = (i: number, p: Partial<EditRow>) =>
    setEdits((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...p } : e)));
  const remove = (i: number) => setEdits((prev) => prev.filter((_, idx) => idx !== i));
  const addManual = () =>
    setEdits((prev) => [...prev, { find: "", replace: "", accepted: true }]);

  if (applied && phase === "idle") {
    return (
      <div className="mt-2 flex items-center gap-3 text-xs">
        <span className="rounded bg-green-100 px-1.5 py-0.5 font-medium text-green-700 dark:bg-green-500/20 dark:text-green-300">
          ✓ Applied
        </span>
        <a href={downloadHref} className="text-accent hover:underline">
          Download updated .docx
        </a>
        <button
          type="button"
          onClick={prepare}
          disabled={pending}
          className="text-black/45 hover:underline disabled:opacity-50 dark:text-white/45"
        >
          Apply again
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 text-xs">
      {phase === "idle" && (
        <button
          type="button"
          onClick={prepare}
          disabled={pending}
          className="rounded border border-black/20 px-2 py-1 font-medium hover:bg-black/[.04] disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
        >
          {pending ? "Reading your manuscript & preparing edits…" : "Review & insert edits into .docx →"}
        </button>
      )}

      {phase === "review" && (
        <div className="space-y-3 rounded-md border border-black/10 p-3 dark:border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-black/55 dark:text-white/55">
              {edits.length > 0
                ? "Accept, reject, or edit each change. Only accepted edits are inserted."
                : "No line-level edits were auto-extracted (this fix is mostly structural). Add your own below."}
            </p>
            <button type="button" onClick={addManual} className="font-medium text-accent hover:underline">
              + Add your own edit
            </button>
          </div>
          {note && <p className="italic text-black/50 dark:text-white/50">{note}</p>}

          {edits.map((e, i) => (
            <div
              key={i}
              className={`space-y-1 rounded border p-2 ${
                e.accepted
                  ? "border-black/10 dark:border-white/10"
                  : "border-black/10 opacity-50 dark:border-white/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-black/50 dark:text-white/50">Edit {i + 1}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => patch(i, { accepted: true })}
                    className={`rounded px-1.5 py-0.5 font-medium ${
                      e.accepted
                        ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300"
                        : "text-black/40 hover:bg-black/[.04] dark:text-white/40"
                    }`}
                  >
                    ✓ Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => patch(i, { accepted: false })}
                    className={`rounded px-1.5 py-0.5 font-medium ${
                      !e.accepted
                        ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                        : "text-black/40 hover:bg-black/[.04] dark:text-white/40"
                    }`}
                  >
                    ✗ Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="ml-1 text-black/35 hover:text-red-600 dark:text-white/35"
                    title="Delete this edit"
                  >
                    🗑
                  </button>
                </div>
              </div>
              <label className="block text-black/45 dark:text-white/45">
                Find (must match your manuscript exactly):
              </label>
              <textarea
                value={e.find}
                onChange={(ev) => patch(i, { find: ev.target.value })}
                rows={2}
                disabled={!e.accepted}
                placeholder="Paste the exact text to replace…"
                className="w-full rounded border border-black/15 bg-red-50/40 p-1.5 font-mono text-[11px] disabled:opacity-50 dark:border-white/15 dark:bg-red-500/10"
              />
              <label className="block text-black/45 dark:text-white/45">Replace with:</label>
              <textarea
                value={e.replace}
                onChange={(ev) => patch(i, { replace: ev.target.value })}
                rows={2}
                disabled={!e.accepted}
                placeholder="The revised text…"
                className="w-full rounded border border-black/15 bg-green-50/40 p-1.5 font-mono text-[11px] disabled:opacity-50 dark:border-white/15 dark:bg-green-500/10"
              />
            </div>
          ))}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={apply}
              disabled={pending || acceptedCount === 0}
              className="rounded-md bg-accent px-3 py-1 font-medium text-white hover:bg-accent-hover disabled:opacity-60"
            >
              {pending
                ? "Inserting…"
                : `Insert ${acceptedCount} accepted edit${acceptedCount === 1 ? "" : "s"} & save`}
            </button>
            <button
              type="button"
              onClick={() => setPhase("idle")}
              className="text-black/45 hover:underline dark:text-white/45"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="space-y-1 rounded-md border border-green-600/30 bg-green-50/50 p-3 dark:bg-green-500/10">
          <p className="font-medium text-green-700 dark:text-green-300">
            Inserted {appliedCount} edit{appliedCount === 1 ? "" : "s"} into a new version.
          </p>
          <a href={downloadHref} className="inline-block text-accent hover:underline">
            Download updated .docx
          </a>
          {failed.length > 0 && (
            <p className="text-amber-700 dark:text-amber-300">
              {failed.length} edit{failed.length === 1 ? "" : "s"} couldn’t be located and were
              skipped — re-open and fix the “Find” text to match exactly.
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="mt-2 space-y-1 text-red-600">
          <p>{error}</p>
          {failed.length > 0 && (
            <ul className="list-disc pl-4">
              {failed.map((e, i) => (
                <li key={i} className="font-mono text-[11px]">
                  not found: “{e.find.slice(0, 80)}
                  {e.find.length > 80 ? "…" : ""}”
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
