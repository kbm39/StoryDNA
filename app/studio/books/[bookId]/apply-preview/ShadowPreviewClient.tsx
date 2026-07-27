"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { generateStudioShadowPreview } from "@/app/studio/actions/shadow-preview.ts";
import { promoteStudioShadowManuscript } from "@/app/studio/actions/shadow-promotion.ts";
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
  const [promotion, setPromotion] = useState<{ versionNumber: number; label: string; versionId: string } | null>(null);
  const [promotePending, startPromote] = useTransition();
  const [ackNonActive, setAckNonActive] = useState(false);
  const [ackCanonical, setAckCanonical] = useState(false);
  const [promotionLabel, setPromotionLabel] = useState("");
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

  function promoteShadow() {
    if (!shadow) return;
    setError(null);
    startPromote(async () => {
      const result = await promoteStudioShadowManuscript({
        manuscriptId: bookId,
        expectedActiveVersionId: manifest.expectedActiveVersionId,
        expectedDecisionSnapshotHash: manifest.integrity.decisionSnapshotHash,
        expectedShadowHash: shadow.application.finalHash,
        selectedRevisionIds: [...selected],
        conflictResolutions,
        confirmation: {
          acknowledgedNonActive: ackNonActive,
          acknowledgedCanonicalUnchanged: ackCanonical,
          promotionLabel: promotionLabel.trim() || null,
        },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPromotion({
        versionNumber: result.promotion.versionNumber,
        label: result.promotion.label,
        versionId: result.manuscriptVersionId,
      });
    });
  }

  const canPromote =
    shadow?.integrity.readyForPromotionReview === true &&
    shadow.application.unresolvedConflictCount === 0 &&
    shadow.application.appliedRevisionCount > 0;

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

          {canPromote && !promotion ? (
            <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm">
              <h3 className="font-serif text-lg font-semibold text-emerald-950">Promote to Draft Version</h3>
              <p className="mt-1 text-emerald-900">
                Create a new non-active manuscript version from this shadow preview. Your active manuscript and
                current_version_id will not change.
              </p>
              <dl className="mt-3 grid gap-2 sm:grid-cols-3">
                <div><dt className="text-emerald-800/70">Applied revisions</dt><dd>{shadow.application.appliedRevisionCount}</dd></div>
                <div><dt className="text-emerald-800/70">Shadow words</dt><dd>{shadow.application.finalWordCount}</dd></div>
                <div><dt className="text-emerald-800/70">Net change</dt><dd>{shadow.application.netWordChange}</dd></div>
              </dl>
              <label className="mt-4 block">
                <span className="text-xs text-emerald-900">Optional version label</span>
                <input
                  type="text"
                  value={promotionLabel}
                  onChange={(e) => setPromotionLabel(e.target.value)}
                  placeholder="Studio shadow promotion (2026-07-27)"
                  className="mt-1 w-full rounded border border-emerald-200 bg-white px-3 py-2 text-sm"
                />
              </label>
              <div className="mt-4 space-y-2">
                <label className="flex items-start gap-2">
                  <input type="checkbox" checked={ackNonActive} onChange={(e) => setAckNonActive(e.target.checked)} />
                  <span>I understand this creates a non-active draft version that is not yet canonical.</span>
                </label>
                <label className="flex items-start gap-2">
                  <input type="checkbox" checked={ackCanonical} onChange={(e) => setAckCanonical(e.target.checked)} />
                  <span>I understand my active manuscript and current_version_id will remain unchanged.</span>
                </label>
              </div>
              <button
                type="button"
                disabled={promotePending || !ackNonActive || !ackCanonical}
                onClick={promoteShadow}
                className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                Promote Shadow to Draft Version
              </button>
            </section>
          ) : null}

          {promotion ? (
            <section className="rounded-xl border border-emerald-300 bg-white p-5 text-sm">
              <h3 className="font-serif text-lg font-semibold">Draft Version Created</h3>
              <p className="mt-1">
                Version {promotion.versionNumber}: {promotion.label}
              </p>
              <p className="mt-2 text-black/55">
                This version is not active. Activation requires a separate explicit step.
              </p>
              <Link
                href={`/studio/books/${bookId}`}
                className="mt-4 inline-block rounded-lg border px-4 py-2 text-sm"
              >
                View Version History
              </Link>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
