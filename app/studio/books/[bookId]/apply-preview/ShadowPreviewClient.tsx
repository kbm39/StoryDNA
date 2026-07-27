"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { generateStudioShadowPreview } from "@/app/studio/actions/shadow-preview.ts";
import type { StudioRevisionExport } from "@/lib/studio/export-types.ts";
import type { ShadowConflictResolution, StudioShadowManuscript } from "@/lib/studio/shadow-types.ts";
import { buildTextualDiffLines, formatTextualDiffForDisplay } from "@/lib/studio/textual-diff.ts";

export function ShadowPreviewClient({
  bookId,
  manifest,
  defaultSelectedIds,
}: {
  bookId: string;
  manifest: StudioRevisionExport;
  defaultSelectedIds: readonly string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(defaultSelectedIds));
  const [conflictResolutions, setConflictResolutions] = useState<ShadowConflictResolution[]>([]);
  const [shadow, setShadow] = useState<StudioShadowManuscript | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [changeIndex, setChangeIndex] = useState(0);

  const eligibleItems = useMemo(
    () => manifest.items.filter((item) => !item.planningOnly),
    [manifest.items],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function resolveConflict(conflictId: string, choice: ShadowConflictResolution["choice"]) {
    setConflictResolutions((prev) => {
      const rest = prev.filter((r) => r.conflictId !== conflictId);
      return [...rest, { conflictId, choice }];
    });
  }

  function generate() {
    setError(null);
    start(async () => {
      const result = await generateStudioShadowPreview({
        manuscriptId: bookId,
        expectedActiveVersionId: manifest.expectedActiveVersionId,
        expectedDecisionSnapshotHash: manifest.integrity.decisionSnapshotHash,
        selectedRevisionIds: [...selected],
        conflictResolutions,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setShadow(result.shadow);
      setChangeIndex(0);
    });
  }

  const currentChange = shadow?.appliedItems[changeIndex] ?? null;

  const downloadQuery = shadow
    ? new URLSearchParams({
        expectedActiveVersionId: manifest.expectedActiveVersionId ?? "",
        expectedDecisionSnapshotHash: manifest.integrity.decisionSnapshotHash,
        selected: [...selected].join(","),
      }).toString()
    : "";

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-950">
        <p className="font-medium">This is a non-canonical preview. Your active manuscript has not been changed.</p>
        <p className="mt-1">Preview only — not yet canonical.</p>
      </div>

      <section className="rounded-xl border border-black/10 bg-paper p-5">
        <h3 className="font-serif text-lg font-semibold">Revision Selection</h3>
        <p className="mt-1 text-sm text-black/55">
          Safe, conflict-free revisions are preselected. Unsafe or blocked items require manual review.
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {eligibleItems.map((item) => {
            const blocked =
              !item.applicability.safeToApplyLater || item.applicability.conflictReasons.length > 0;
            return (
              <li key={item.itemId} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={selected.has(item.revisionCandidateId)}
                  disabled={blocked}
                  onChange={() => toggle(item.revisionCandidateId)}
                />
                <div>
                  <p className="font-medium">{item.expert.expertName} — {item.revision.disposition}</p>
                  <p className="text-xs text-black/55">{item.manuscriptLocation.locatorLabel ?? "No locator"}</p>
                  {blocked ? (
                    <p className="text-xs text-amber-800">
                      Not preselected:{" "}
                      {item.applicability.conflictReasons.join(", ") || "not safe for automatic application"}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          disabled={pending}
          onClick={generate}
          className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Generate Shadow Manuscript Preview
        </button>
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      </section>

      {manifest.conflicts.length > 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm">
          <h3 className="font-serif text-lg font-semibold">Conflict Resolution</h3>
          {manifest.conflicts.map((conflict) => (
            <div key={conflict.conflictId} className="mt-4 border-t border-amber-200 pt-4 first:border-0 first:pt-0">
              <p className="font-medium">{conflict.conflictType}</p>
              <p className="mt-1">{conflict.explanation}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(
                  [
                    ["apply_item_a", "Keep A"],
                    ["apply_item_b", "Keep B"],
                    ["exclude_both", "Exclude Both"],
                  ] as const
                ).map(([choice, label]) => (
                  <button
                    key={choice}
                    type="button"
                    className="rounded-lg border border-black/10 px-3 py-1 text-xs"
                    onClick={() => resolveConflict(conflict.conflictId, choice)}
                  >
                    {label}
                  </button>
                ))}
                <Link
                  href={`/studio/books/${bookId}/revisions`}
                  className="rounded-lg border border-black/10 px-3 py-1 text-xs"
                >
                  Return to Revision Board
                </Link>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {shadow ? (
        <>
          <section className="rounded-xl border border-black/10 bg-paper p-5">
            <h3 className="font-serif text-lg font-semibold">Shadow Preview Status</h3>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
              <div><dt className="text-black/50">Applied</dt><dd>{shadow.application.appliedRevisionCount}</dd></div>
              <div><dt className="text-black/50">Skipped</dt><dd>{shadow.application.skippedRevisionCount}</dd></div>
              <div><dt className="text-black/50">Blocked/Failed</dt><dd>{shadow.application.failedRevisionCount}</dd></div>
              <div><dt className="text-black/50">Source words</dt><dd>{shadow.source.sourceWordCount}</dd></div>
              <div><dt className="text-black/50">Shadow words</dt><dd>{shadow.application.finalWordCount}</dd></div>
              <div><dt className="text-black/50">Net change</dt><dd>{shadow.application.netWordChange}</dd></div>
            </dl>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-black/10 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-black/45">Canonical Manuscript</h4>
              <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap text-xs">{shadow.chapters[0]?.sourceText ?? ""}</pre>
            </div>
            <div className="rounded-xl border border-black/10 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-black/45">Shadow Manuscript</h4>
              <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap text-xs">{shadow.shadowText}</pre>
            </div>
          </section>

          {currentChange ? (
            <section className="rounded-xl border border-black/10 p-5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-medium">
                  Change {changeIndex + 1} of {shadow.appliedItems.length}
                </h4>
                <div className="flex gap-2">
                  <button type="button" disabled={changeIndex <= 0} onClick={() => setChangeIndex((i) => i - 1)} className="rounded border px-2 py-1 text-xs">Previous</button>
                  <button type="button" disabled={changeIndex >= shadow.appliedItems.length - 1} onClick={() => setChangeIndex((i) => i + 1)} className="rounded border px-2 py-1 text-xs">Next</button>
                </div>
              </div>
              <p className="mt-2">Expert: {currentChange.expertName} · {currentChange.applicationState}</p>
              <pre className="mt-2 overflow-x-auto rounded bg-black/[0.03] p-3 text-xs whitespace-pre-wrap">
                {formatTextualDiffForDisplay(
                  buildTextualDiffLines(currentChange.originalText, currentChange.finalText),
                )}
              </pre>
            </section>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <a href={`/studio/books/${bookId}/apply-preview/shadow.md?${downloadQuery}`} className="rounded-lg bg-accent px-4 py-2 text-sm text-white">Download Shadow Markdown</a>
            <a href={`/studio/books/${bookId}/apply-preview/manifest.json?${downloadQuery}`} className="rounded-lg border px-4 py-2 text-sm">Download Application Manifest JSON</a>
            <a href={`/studio/books/${bookId}/apply-preview/report.md?${downloadQuery}`} className="rounded-lg border px-4 py-2 text-sm">Download Application Report</a>
          </div>
        </>
      ) : null}
    </div>
  );
}
